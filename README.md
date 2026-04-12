# RiskPulse AI
### Autonomous Market Risk Monitoring System

> A multi-agent AI system that autonomously monitors live financial markets, detects volatility spikes and price anomalies in real-time, and generates AI-powered incident reports — with zero human intervention.

![Status](https://img.shields.io/badge/status-live-brightgreen)
![Python](https://img.shields.io/badge/python-3.9-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-0.104-teal)
![React](https://img.shields.io/badge/React-18-61dafb)
![LLM](https://img.shields.io/badge/LLM-Nvidia%20Nemotron-76b900)

---

## What It Does

RiskPulse AI runs a continuous autonomous pipeline every 60 seconds across 5 live financial assets — Bitcoin, Ethereum, Gold, EUR/USD, and S&P 500. Each cycle, 4 specialized AI agents analyze the market and surface risks before they become critical.

---

## Agent Architecture

```
Yahoo Finance (Live Data)
        │
        ▼
┌────────────────────────────────────────────┐
│           RiskPulse AI Pipeline            │
│                                            │
│  ┌─────────────────┐  ┌─────────────────┐  │
│  │ Volatility Agent│  │  Anomaly Agent  │  │
│  │                 │  │                 │  │
│  │ Rolling std dev │  │ Z-score analysis│  │
│  │ Spike detection │  │ Direction flags │  │
│  └────────┬────────┘  └────────┬────────┘  │
│           └─────────┬──────────┘           │
│                     ▼                      │
│            ┌────────────────┐              │
│            │   Risk Agent   │              │
│            │  Score 0–100   │              │
│            │ LOW→CRITICAL   │              │
│            └───────┬────────┘              │
│                    ▼                       │
│          ┌──────────────────┐              │
│          │   Alert Agent    │ ← Nvidia LLM │
│          │ Incident reports │              │
│          │ Natural language │              │
│          └──────────────────┘              │
└────────────────────────────────────────────┘
        │
        ▼
  WebSocket → React Dashboard (Live)
```

---

## Agents

| Agent | Responsibility | Method |
|-------|---------------|--------|
| **Volatility Agent** | Detects abnormal price volatility | Rolling std deviation over 10 periods |
| **Anomaly Agent** | Flags statistically unusual price moves | Z-score analysis of return distribution |
| **Risk Agent** | Aggregates signals into unified risk score | Weighted combination (60% vol, 40% anomaly) |
| **Alert Agent** | Generates human-readable incident reports | Nvidia Nemotron LLM via OpenRouter |

---

## Risk Levels

| Score | Level | Meaning |
|-------|-------|---------|
| 0 – 14 | 🟢 LOW | Normal market conditions |
| 15 – 34 | 🟡 MEDIUM | Elevated activity, monitor closely |
| 35 – 54 | 🟠 HIGH | Significant risk detected |
| 55 – 100 | 🔴 CRITICAL | Immediate attention required |

---

## Assets Monitored

| Ticker | Asset | Class |
|--------|-------|-------|
| `BTC-USD` | Bitcoin | Cryptocurrency |
| `ETH-USD` | Ethereum | Cryptocurrency |
| `GC=F` | Gold Futures | Commodity |
| `EURUSD=X` | EUR/USD | Forex |
| `SPY` | S&P 500 ETF | Equity |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Market Data | Yahoo Finance (`yfinance`) — free, no API key |
| Statistical Analysis | `pandas`, `numpy` |
| Backend | Python, FastAPI, WebSockets |
| LLM | Nvidia Nemotron 120B via OpenRouter |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, glassmorphism |
| Real-time | WebSocket with auto-reconnect |
| Deploy (BE) | Railway |
| Deploy (FE) | Vercel |

---

## Sample AI-Generated Alert

When risk is triggered, the Alert Agent autonomously produces:

> *"Bitcoin is experiencing a significant volatility spike at 3.2x its 10-period average, accompanied by a downward Z-score of -2.8 — a statistically rare move. This pattern suggests abnormal selling pressure, potentially driven by macro events or liquidation cascades. Traders should consider reducing leveraged long exposure until volatility normalizes."*

---

## Live Dashboard

- **Dark terminal-style UI** with glassmorphism cards
- **Glowing risk indicators** that pulse on critical alerts
- **Per-asset risk meters** with animated circular gauges
- **Live alert feed** with AI-generated incident reports
- **Agent status panel** showing all 4 agents running in real-time
- **Auto-reconnecting WebSocket** — survives network interruptions

---

## Project Structure

```
riskpulse-ai/
├── backend/
│   ├── main.py                  # FastAPI + WebSocket orchestrator
│   ├── data/
│   │   └── market_data.py       # Yahoo Finance data fetcher
│   └── agents/
│       ├── volatility_agent.py  # Rolling volatility spike detection
│       ├── anomaly_agent.py     # Z-score price anomaly detection
│       ├── risk_agent.py        # Risk score aggregation (0–100)
│       └── alert_agent.py       # LLM incident report generation
└── frontend/
    └── src/
        ├── App.tsx              # Main dashboard
        ├── components/
        │   ├── AssetCard.tsx    # Per-asset risk card with glow effects
        │   ├── AlertFeed.tsx    # Live AI alert panel
        │   ├── SummaryBar.tsx   # Risk level overview
        │   ├── RiskMeter.tsx    # Animated circular gauge
        │   └── Badge.tsx        # Risk level badge
        └── hooks/
            └── useWebSocket.ts  # Auto-reconnecting WebSocket hook
```

---

## How the Pipeline Runs

```
Every 60 seconds (autonomous, no human trigger):

1. Fetch OHLCV data for all 5 assets via Yahoo Finance
2. Volatility Agent  →  calculate rolling std, flag if ratio ≥ threshold
3. Anomaly Agent     →  compute Z-score, flag if |z| ≥ threshold
4. Risk Agent        →  weighted aggregate → score 0–100 + level
5. Alert Agent       →  if risk triggered, call LLM → incident report
6. Broadcast         →  push full snapshot to all WebSocket clients
```

---

*Built for Deriv AI Engineer Interview — demonstrating real-time AI pipelines, multi-agent systems, and autonomous decision-making.*
