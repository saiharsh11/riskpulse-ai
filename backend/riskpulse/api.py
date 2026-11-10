"""
RiskPulse API: read-only, fast, friendly.

On start-up (and then daily at 06:00 UTC) the agents rate the 5 markets. The latest results are
kept in memory only and served read-only to the website. Visitors cannot trigger AI calls.

    uvicorn riskpulse.api:app --port 8001
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from riskpulse import data
from riskpulse.agents import CHAINS, PROVIDERS, Meter, _env, run
from riskpulse.data import ASSETS, median

log = logging.getLogger("riskpulse")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

STATE: dict = {"status": "starting", "started_at": None, "finished_at": None, "results": [], "usage": {}, "charts": {}, "error": None}
RUN_HOUR_UTC = 6
# Latest board (the agents' own ratings only — no personal data, no price history) so visitors get
# results instantly, even right after a restart. Gitignored.
SAVED = Path(__file__).resolve().parent.parent / "var" / "board.json"
STALE_AFTER = 24 * 3600
RETRY_AFTER = 30 * 60  # a run that rated nothing is retried in 30 minutes, not tomorrow


def _load_saved() -> None:
    try:
        saved = json.loads(SAVED.read_text())
        STATE.update(saved, status="ready")
    except (FileNotFoundError, json.JSONDecodeError):
        pass


def _save() -> None:
    SAVED.parent.mkdir(parents=True, exist_ok=True)
    tmp = SAVED.with_suffix(".tmp")
    keep = {k: STATE[k] for k in ("started_at", "finished_at", "results", "usage", "charts")}
    tmp.write_text(json.dumps(keep))
    tmp.replace(SAVED)  # atomic swap: readers never see a half-written file


def _models() -> dict[str, list[str]]:
    """Active model chain per agent (only providers with a key configured)."""
    return {agent: [m for p, m in chain if _env(PROVIDERS[p]["key"])] for agent, chain in CHAINS.items()
            if agent in ("analyst", "critic")}


def _good(results: list) -> int:
    """How many markets got a rating that passed the guardrails."""
    return sum(1 for r in results if (r.get("rating") or {}).get("level") and not r.get("guardrail_problems") and not r.get("error"))


def _chart(asset: str) -> dict:
    """Last 120 closes (normalised to 100) + long-run typical move — for the website's chart."""
    c = data.closes(asset)[-120:]
    base = c[0][1]
    m = data.moves(asset)
    return {"points": [round(v / base * 100, 2) for _, v in c], "from": str(c[0][0]), "to": str(c[-1][0]),
            "last_price": round(c[-1][1], 4 if c[-1][1] < 10 else 2),
            "change_1d_pct": round(m[-1][1], 2) if m else None,
            "long_run_typical_abs_move_pct": round(median([abs(v) for _, v in m]), 2)}


async def run_once() -> bool:
    """One full run. Returns True if at least one market was rated."""
    if not any(_models().values()):
        log.warning("no model API keys configured (GROQ_API_KEY / OPENROUTER_API_KEY); skipping run")
        if not STATE["results"]:
            STATE.update(status="error", error="No model API keys are configured on the server.")
        return False
    meter = Meter(max_calls=45, max_tokens=90_000)
    had_results = bool(STATE["results"])
    STATE.update(refreshing=True, error=None)
    if not had_results:
        STATE.update(status="running", started_at=time.time())
    run_started = time.time()
    try:
        results = await run(dict(ASSETS), meter)
        await asyncio.to_thread(data.preload_all)  # chart data for the website (one combined request)
        charts = {}
        for a in ASSETS:
            try:
                charts[a] = await asyncio.to_thread(_chart, a)
            except Exception as e:
                charts[a] = {"error": str(e)[:120]}
        usage = {"calls": meter.calls, "tokens": meter.tokens, "prompt_tokens": meter.prompt_tokens,
                 "completion_tokens": meter.completion_tokens, "by_agent": meter.by_agent,
                 "max_calls": meter.max_calls, "max_tokens": meter.max_tokens, "cost_usd": 0.0,
                 "seconds": round(time.time() - run_started)}
        if not _good(results) and _good(STATE["results"]):
            log.warning("run rated no markets; keeping the previous board")
            return False
        STATE.update(status="ready", error=None, results=results, charts=charts, usage=usage,
                     started_at=run_started, finished_at=time.time())
        _save()
        return _good(results) > 0
    except Exception as e:
        log.exception("run failed")
        if not had_results:  # keep showing the last good board if we have one
            STATE.update(status="error", error=f"{type(e).__name__}: {e}"[:300])
        return False
    finally:
        STATE["refreshing"] = False


def _next_run() -> datetime:
    now = datetime.now(timezone.utc)
    nxt = now.replace(hour=RUN_HOUR_UTC, minute=0, second=0, microsecond=0)
    return nxt if nxt > now else nxt + timedelta(days=1)


async def scheduler() -> None:
    _load_saved()
    ok = True
    if not STATE["results"] or time.time() - (STATE.get("finished_at") or 0) > STALE_AFTER:
        ok = await run_once()
    while True:
        nxt = _next_run()
        if not ok:
            nxt = min(nxt, datetime.now(timezone.utc) + timedelta(seconds=RETRY_AFTER))
        STATE["next_run"] = nxt.isoformat()
        await asyncio.sleep(max(60, (nxt - datetime.now(timezone.utc)).total_seconds()))
        ok = await run_once()


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(scheduler())
    yield
    task.cancel()


app = FastAPI(title="RiskPulse AI", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_methods=["GET"], allow_headers=["*"],
                   allow_origins=[o.strip() for o in (_env("CORS_ORIGINS") or "https://riskpulse-ai.vercel.app").split(",")])


@app.get("/health")
def health():
    return {"status": "ok", "agents": STATE["status"]}


@app.get("/api/board")
def board():
    return {
        "status": STATE["status"], "error": STATE["error"], "refreshing": STATE.get("refreshing", False),
        "started_at": STATE["started_at"], "finished_at": STATE["finished_at"],
        "next_run_utc": STATE.get("next_run") or _next_run().isoformat(), "models": _models(),
        "results": [{k: r.get(k) for k in ("asset", "name", "rating", "critic", "guardrail_problems", "error", "trace")}
                    for r in STATE["results"]],
        "charts": STATE["charts"], "usage": STATE["usage"],
    }
