# RiskPulse AI

**A small team of AI agents that takes a calm, clear look at the financial markets every day.**

Each morning the agents study five markets (the S&P 500, Bitcoin, Ethereum, gold and EUR/USD), give each one a risk rating for the week ahead, and show exactly how they got there. One agent investigates, a second agent on a different model family checks its work, and guardrails validate every answer before anyone sees it.

**Live:** https://riskpulse-ai.vercel.app

> A personal learning project. Ratings describe how much prices may move, not which way. Nothing here is financial advice.

---

## What you see

For each market:

- **A rating:** LOW, MEDIUM, HIGH or CRITICAL, judged against that market's own normal. A ±1% day is wild for EUR/USD and quiet for Bitcoin.
- **A 0 to 100 risk score**, chosen by the agent inside its level's band (LOW 0-24, MEDIUM 25-49, HIGH 50-74, CRITICAL 75-100).
- **One plain-English sentence** written for someone new to markets.
- **The reasons**, each tied to the tool result that backs it.
- **The full conversation:** every tool call, the critic's objections and any revision.

## How it works

```
                  ┌──────────────── MCP (stdio) ────────────────┐
 Yahoo Finance ─► │  daily_moves · compare_assets · find_periods │  read-only tools
 (daily closes)   └───────────────▲─────────────────────▲───────┘
                                  │ tool calls          │ one check
                       ┌──────────┴─────────┐   ┌───────┴────────┐
                       │   Risk analyst     │◄──│     Critic     │
                       │   gpt-oss-120b     │──►│    Qwen 3.8    │
                       └──────────┬─────────┘   └────────────────┘
                                  │ rating (JSON)
                       ┌──────────▼─────────┐
                       │     Guardrails     │  schema · score band · evidence · no advice
                       └──────────┬─────────┘
                                  ▼
                        FastAPI  /api/board  ──►  React site
```

1. **The risk analyst** gets one market and a small set of read-only tools served over the [Model Context Protocol](https://modelcontextprotocol.io). It decides which tools to call, reads the results and returns a structured rating.
2. **Guardrails** check the answer: valid format, a score inside the level's band, a plain summary, every reason backed by a tool that actually returned evidence, and no buy or sell advice. A rating that fails gets one chance to fix itself.
3. **The critic** runs on a different model family on purpose, so its second opinion is independent. It can verify one claim with a tool, then accepts the rating or asks for a revision.
4. **If the critic objects**, the analyst reconsiders. The revision goes through the guardrails again. If it still fails, the page says so instead of quietly hiding the disagreement.
5. The finished board is saved and served instantly. A fresh run happens once a day in the background, so the page never waits on the models.

### Models (all free tiers)

| Role | First choice | Backups |
|---|---|---|
| Risk analyst | gpt-oss-120b (OpenAI, open-weight) via Groq | Qwen 3.8, Gemma 4, Nemotron |
| Critic | Qwen 3.8 (Alibaba, open-weight) via Groq | Gemma 4, gpt-oss-20b, Nemotron |

If a model is busy or rate-limited, the next one in the chain steps in. Markets are rated one at a time to stay under free per-minute limits, and a market that still fails is retried once at the end of the run.

### Safety and cost

- **Read-only:** the agents can only read prices. Nothing they do can write, trade or reach anything else.
- **No secrets in the tool server:** the MCP server runs in a separate process that never receives the API keys.
- **A usage meter** caps every run (45 model calls, 90k tokens). The live usage is shown on the site. Cost so far: $0.
- **Nothing personal is stored:** prices are held in memory, and the only saved file is the latest board.

## Run it locally

```bash
# backend (Python 3.12+)
cd backend
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # add free keys from console.groq.com and openrouter.ai
.venv/bin/uvicorn riskpulse.api:app --port 8001

# frontend
cd frontend
npm install
cp .env.example .env.local  # point VITE_API_URL at your backend
npm run dev                 # opens the site; the dashboard is at /dashboard
```

Tests (offline, no model calls): `cd backend && .venv/bin/python -m pytest tests/test_riskpulse.py -q`

## Project layout

```
backend/riskpulse/
  data.py         price history from Yahoo Finance (standard library, yfinance as fallback), in memory only
  mcp_server.py   the read-only MCP tools
  agents.py       analyst and critic loops, model fallback chains, guardrails, usage meter
  api.py          FastAPI app, daily scheduler, saved board
frontend/src/
  landing/        the landing page (live particle chart, agents walkthrough, phone preview)
  research/       the dashboard
```

## Deploy

- **Backend:** Railway, started by the `Procfile`. Set `GROQ_API_KEY`, `OPENROUTER_API_KEY` and `CORS_ORIGINS` (your frontend URL).
- **Frontend:** Vercel, with `VITE_API_URL` set to the backend URL.

## What's next

- **A judge agent** that grades last week's ratings against what actually happened, so the team builds a real track record (the `track_record` tool is already in place, waiting for history).
- **A coordinator** that decides which markets need a closer look.
