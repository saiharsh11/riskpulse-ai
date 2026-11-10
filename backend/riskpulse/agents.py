"""
RiskPulse agents: Risk analyst + Critic, using the RiskPulse MCP server's tools and free
OpenRouter models. Built to use as few tokens as possible.

Token savings: short prompts, compact tool outputs, low reasoning effort, small max_tokens,
capped tool calls per agent, at most one revision, and a hard budget for the whole run.
Agents have no write access: they return JSON, and the system checks it (guardrails) before
anything is kept.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

from mcp import ClientSession
from mcp.client.stdio import StdioServerParameters, stdio_client

BACKEND = Path(__file__).resolve().parent.parent
# A different model for each agent (all open-weight, all free tiers), each with its own fallbacks.
# Different model families mean the Critic doesn't share the Analyst's blind spots, and each model has
# its own free daily allowance. Providers without a key are skipped automatically.
CHAINS: dict[str, list[tuple[str, str]]] = {
    # hardest job (multi-step tool use) → strongest tool-calling model
    "analyst": [("groq", "openai/gpt-oss-120b"), ("groq", "qwen/qwen3.8-27b"),
                ("openrouter", "google/gemma-4-31b-it:free"), ("openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free")],
    # independent check → a different family from the Analyst
    "critic": [("groq", "qwen/qwen3.8-27b"), ("openrouter", "google/gemma-4-31b-it:free"),
               ("groq", "openai/gpt-oss-20b"), ("openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free")],
    # planned agents (not active yet)
    "coordinator": [("groq", "openai/gpt-oss-20b"), ("groq", "qwen/qwen3.8-27b")],
    "judge": [("openrouter", "google/gemma-4-31b-it:free"), ("openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free"),
              ("groq", "openai/gpt-oss-120b")],
}
CHAIN = CHAINS["analyst"]  # kept for older diagnostic scripts
PROVIDERS = {
    "groq": {"url": "https://api.groq.com/openai/v1/chat/completions", "key": "GROQ_API_KEY", "gap": 0.6},
    "openrouter": {"url": "https://openrouter.ai/api/v1/chat/completions", "key": "OPENROUTER_API_KEY", "gap": 3.2},
}
LEVELS = ("LOW", "MEDIUM", "HIGH", "CRITICAL")
BANDS = {"LOW": (0, 24), "MEDIUM": (25, 49), "HIGH": (50, 74), "CRITICAL": (75, 100)}
TOOLS_FOR = {
    # track_record joins once the Judge has graded history to share (it's empty until then)
    "analyst": {"daily_moves", "compare_assets", "find_periods"},
    "critic": {"daily_moves", "compare_assets", "find_periods"},
}
MAX_TOOL_CALLS = {"analyst": 4, "critic": 1}
MAX_OUT_TOKENS = 700
ADVICE = re.compile(r"\b(buy|sell)\b(?!-?off)|\byou should\b|\brecommend (buying|selling)\b", re.I)

ANALYST = """You rate the risk of ONE market for the next 7 days: LOW (calmer than its normal), MEDIUM (about normal),
HIGH (rougher than normal) or CRITICAL (among its roughest weeks). Compare with THAT market's own normal.
Use tools for evidence (max 4 calls; call several at once if you can). Every reason must come from a tool result, not general knowledge. Never give buy/sell advice.
Reply with ONLY JSON:
{"level":"LOW|MEDIUM|HIGH|CRITICAL","score":0-100,"daily_swing_pct":number,"confidence":"low|medium|high",
"summary":"one friendly sentence for someone new to markets, <=25 words, no jargon, no advice",
"reasons":[{"claim":"<=20 words, with a number","tool":"tool name that showed it"}]}  (2-3 reasons)
score = your risk score inside the level's band: LOW 0-24, MEDIUM 25-49, HIGH 50-74, CRITICAL 75-100."""

CRITIC = """You check a risk rating for one market. Look for overreaction to one big day, ignoring the market's
own normal, or claims not backed by numbers. Score bands are fixed: LOW 0-24, MEDIUM 25-49, HIGH 50-74, CRITICAL 75-100. You may call ONE tool to verify. No buy/sell advice.
Reply with ONLY JSON: {"verdict":"accept|revise","issue":"<=25 words"}"""


# ───────────────────────── usage meter ─────────────────────────
@dataclass
class Meter:
    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    by_agent: dict = field(default_factory=dict)
    max_calls: int = 30
    max_tokens: int = 120_000

    def add(self, agent: str, usage: dict) -> None:
        self.calls += 1
        self.prompt_tokens += int(usage.get("prompt_tokens") or 0)
        self.completion_tokens += int(usage.get("completion_tokens") or 0)
        self.by_agent[agent] = self.by_agent.get(agent, 0) + 1

    @property
    def tokens(self) -> int:
        return self.prompt_tokens + self.completion_tokens

    def exhausted(self) -> bool:
        return self.calls >= self.max_calls or self.tokens >= self.max_tokens


# ───────────────────────── model providers (stdlib only) ─────────────────────────
def _env(name: str) -> str:
    val = os.getenv(name, "").strip()
    if not val:
        env = BACKEND / ".env"
        if env.exists():
            for line in env.read_text().splitlines():
                if line.startswith(name + "="):
                    val = line.split("=", 1)[1].strip()
    return val


def _key() -> str:  # kept for small diagnostic scripts
    return _env("OPENROUTER_API_KEY")


_last_call: dict[str, float] = {}


def chat(messages: list[dict], tools: list[dict] | None, meter: Meter, agent: str, max_tokens: int = MAX_OUT_TOKENS) -> dict:
    """One model call, falling back along CHAIN. Calls are spaced out to respect free-tier rate limits."""
    if meter.exhausted():
        raise RuntimeError("run budget exhausted")
    errors = []
    for provider, model in CHAINS.get(agent, CHAINS["analyst"]):
        cfg = PROVIDERS[provider]
        key = _env(cfg["key"])
        if not key:
            continue
        body = {"model": model, "messages": messages, "max_tokens": max_tokens, "temperature": 0.2}
        if provider == "openrouter":
            body["reasoning"] = {"effort": "low"}
        elif "gpt-oss" in model:
            body["reasoning_effort"] = "low"  # fewer hidden reasoning tokens
        elif "qwen" in model:
            body["reasoning_effort"] = "none"
        if tools:
            body["tools"], body["tool_choice"] = tools, "auto"
        for attempt in range(3):
            wait = cfg["gap"] - (time.time() - _last_call.get(provider, 0.0))
            if wait > 0:
                time.sleep(wait)
            _last_call[provider] = time.time()
            headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json", "User-Agent": "RiskPulse-AI/0.1"}
            if provider == "openrouter":
                headers["X-Title"] = "RiskPulse AI (research)"
            req = urllib.request.Request(cfg["url"], data=json.dumps(body).encode(), headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=120) as r:
                    data = json.loads(r.read())
                if "choices" not in data:
                    raise RuntimeError(str(data.get("error", data))[:200])
                meter.add(agent, data.get("usage", {}))
                msg = data["choices"][0]["message"]
                msg["_model"] = f"{provider}/{model}"
                return msg
            except urllib.error.HTTPError as e:
                errors.append(f"{provider}/{model}: HTTP {e.code}")
                if e.code == 429 and attempt < 2:  # free per-minute limit: wait it out, then retry
                    try:
                        delay = float(e.headers.get("retry-after") or 8)
                    except ValueError:
                        delay = 8.0
                    time.sleep(min(30.0, max(2.0, delay)))
                    continue
                break  # next model in the chain
            except Exception as e:
                errors.append(f"{provider}/{model}: {type(e).__name__}: {str(e)[:120]}")
                break
    raise RuntimeError("all models failed: " + "; ".join(errors))


# ───────────────────────── MCP plumbing ─────────────────────────
def _server_params() -> StdioServerParameters:
    # The MCP server gets a minimal environment: no API key, nothing from this machine beyond PATH/HOME.
    env = {k: os.environ[k] for k in ("PATH", "HOME") if k in os.environ}
    return StdioServerParameters(command=sys.executable, args=["-m", "riskpulse.mcp_server"], cwd=str(BACKEND), env=env)


def _openai_tools(mcp_tools, allowed: set[str]) -> list[dict]:
    return [{"type": "function", "function": {"name": t.name, "description": t.description or "",
                                              "parameters": getattr(t, "input_schema", None) or getattr(t, "inputSchema", None) or {"type": "object", "properties": {}}}}
            for t in mcp_tools if t.name in allowed]


def _result_text(res) -> str:
    sc = getattr(res, "structuredContent", None) or getattr(res, "structured_content", None)
    if sc:
        return json.dumps(sc.get("result", sc), separators=(",", ":"))
    text = "".join(getattr(c, "text", "") for c in (res.content or []))
    try:  # re-encode compactly: pretty-printed JSON wastes tokens
        return json.dumps(json.loads(text), separators=(",", ":"))[:1500]
    except json.JSONDecodeError:
        return text[:600]


def parse_json(text: str | None) -> dict:
    if not text:
        return {}
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return {}


async def run_agent(session: ClientSession, mcp_tools, agent: str, system: str, user: str, meter: Meter,
                    trace: list, messages: list | None = None) -> tuple[str, list]:
    tools = _openai_tools(mcp_tools, TOOLS_FOR[agent])
    messages = messages or [{"role": "system", "content": system}]
    messages.append({"role": "user", "content": user})
    used = 0
    nudged = False
    while True:
        allow_tools = used < MAX_TOOL_CALLS[agent]
        msg = await asyncio.to_thread(chat, messages, tools if allow_tools else None, meter, agent)
        calls = msg.get("tool_calls") or []
        if not calls and allow_tools and "<tool_call>" in (msg.get("content") or ""):
            messages.append({"role": "assistant", "content": msg.get("content") or ""})
            messages.append({"role": "user", "content": "Use the tool-calling interface, not text. Or give the final JSON."})
            used += 1  # counts against the budget so this can't loop
            continue
        if not calls and not (msg.get("content") or "").strip() and not nudged:
            # model spent its allowance thinking and returned nothing: one short nudge, a bit more room
            nudged = True
            msg = await asyncio.to_thread(chat, messages + [{"role": "user", "content": "Reply with ONLY the final JSON now."}],
                                          None, meter, agent, 1200)
            calls = []
        if not calls or not allow_tools:
            text = msg.get("content") or ""
            messages.append({"role": "assistant", "content": text})
            trace.append({"agent": agent, "kind": "answer", "model": msg["_model"], "text": text.strip()[:600]})
            return text, messages
        messages.append({"role": "assistant", "content": msg.get("content") or "", "tool_calls": calls})
        for c in calls:
            name = c["function"]["name"]
            try:
                args = json.loads(c["function"].get("arguments") or "{}")
            except json.JSONDecodeError:
                args = {}
            if name not in TOOLS_FOR[agent] or used >= MAX_TOOL_CALLS[agent]:
                out = json.dumps({"error": f"tool {name} not allowed or tool budget used"})
            else:
                used += 1
                try:
                    res = await session.call_tool(name, args)
                    out = _result_text(res)
                except Exception as e:
                    out = json.dumps({"error": f"{type(e).__name__}: {e}"[:200]})
            trace.append({"agent": agent, "kind": "tool", "tool": name, "args": args, "result": out[:300]})
            messages.append({"role": "tool", "tool_call_id": c["id"], "content": out})


# ───────────────────────── guardrails ─────────────────────────
def check_rating(r: dict, tools_used: set[str]) -> list[str]:
    problems = []
    if r.get("level") not in LEVELS:
        problems.append("level must be LOW, MEDIUM, HIGH or CRITICAL")
    if r.get("confidence") not in ("low", "medium", "high"):
        problems.append("confidence must be low, medium or high")
    if not isinstance(r.get("daily_swing_pct"), (int, float)):
        problems.append("daily_swing_pct must be a number")
    score, band = r.get("score"), BANDS.get(r.get("level"))
    if not isinstance(score, (int, float)) or isinstance(score, bool):
        problems.append("score must be a number 0-100")
    elif band and not band[0] <= score <= band[1]:
        problems.append(f"score {score} must be within {band[0]}-{band[1]} for {r.get('level')}")
    if not isinstance(r.get("summary"), str) or not r["summary"].strip():
        problems.append("summary must be one plain sentence")
    reasons = r.get("reasons") or []
    if not (1 <= len(reasons) <= 4):
        problems.append("give 2-3 reasons")
    for x in reasons:
        if x.get("tool") not in tools_used:
            problems.append(f"reason not backed by a tool that returned evidence: {x.get('claim', '')[:40]}")
    if ADVICE.search(json.dumps(r)):
        problems.append("no buy/sell advice")
    return problems


def _evidence_tools(trace: list) -> set[str]:
    """Tools that actually returned evidence (an error or an empty history doesn't count)."""
    out = set()
    for t in trace:
        if t["kind"] != "tool":
            continue
        res = t.get("result") or ""
        if res.startswith('{"error"') or "no graded history yet" in res:
            continue
        out.add(t["tool"])
    return out


async def rate(session: ClientSession, mcp_tools, asset: str, name: str, meter: Meter) -> dict:
    trace: list = []
    text, history = await run_agent(session, mcp_tools, "analyst", ANALYST, f"Rate {name} ({asset}).", meter, trace)
    rating = parse_json(text)
    used = _evidence_tools(trace)
    problems = check_rating(rating, used)
    if problems and not meter.exhausted():
        text, history = await run_agent(session, mcp_tools, "analyst", ANALYST,
                                        "Fix and resend ONLY the JSON: " + "; ".join(problems), meter, trace, history)
        rating = parse_json(text)
        used = _evidence_tools(trace)
        problems = check_rating(rating, used)

    verdict = {"verdict": "skipped", "issue": "rating failed guardrails"}
    if not problems and not meter.exhausted():
        c_text, _ = await run_agent(session, mcp_tools, "critic", CRITIC,
                                    f"{name} ({asset}) rating:\n{json.dumps(rating)}", meter, trace)
        verdict = parse_json(c_text) or {"verdict": "accept", "issue": "unparseable critic reply"}
        if verdict.get("verdict") == "revise" and not meter.exhausted():
            text, history = await run_agent(session, mcp_tools, "analyst", ANALYST,
                                            f"Critic says: {verdict.get('issue')}. Reconsider; reply ONLY JSON.", meter, trace, history)
            revised = parse_json(text)
            used = _evidence_tools(trace)
            rev_problems = check_rating(revised, used)
            if rev_problems and not meter.exhausted():  # one chance to fix a broken revision
                text, history = await run_agent(session, mcp_tools, "analyst", ANALYST,
                                                "Fix and resend ONLY the JSON: " + "; ".join(rev_problems), meter, trace, history)
                revised = parse_json(text)
                used = _evidence_tools(trace)
                rev_problems = check_rating(revised, used)
            if not rev_problems:
                rating = revised
            else:
                verdict["unresolved"] = True  # critic objected, but no valid revision came back
    return {"asset": asset, "name": name, "rating": rating, "guardrail_problems": problems,
            "critic": verdict, "trace": trace}


async def run(assets: dict[str, str], meter: Meter) -> list[dict]:
    async with stdio_client(_server_params(), errlog=open(os.devnull, "w")) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            mcp_tools = (await session.list_tools()).tools
            sem = asyncio.Semaphore(1)  # one market at a time: stays under free per-minute token limits

            async def one(asset: str, name: str) -> dict:
                async with sem:
                    if meter.exhausted():
                        return {"asset": asset, "name": name, "rating": {}, "error": "budget exhausted"}
                    try:
                        return await rate(session, mcp_tools, asset, name, meter)
                    except Exception as e:
                        return {"asset": asset, "name": name, "rating": {}, "error": f"{type(e).__name__}: {e}"[:300]}

            results = list(await asyncio.gather(*(one(a, n) for a, n in assets.items())))
            # a market that hit rate limits gets one more try after the per-minute window resets
            for i, r in enumerate(results):
                if r.get("error") and "429" in r["error"] and not meter.exhausted():
                    await asyncio.sleep(60)
                    results[i] = await one(r["asset"], r["name"])
            return results
