# RiskPulse AI — Autonomous Risk Monitoring Bot

## Project Overview

RiskPulse AI is an autonomous, multi-agent risk monitoring system for financial markets. It continuously watches live market data (crypto, forex, stocks) and uses AI agents to detect anomalies, measure volatility spikes, compute risk scores, and auto-generate incident reports — with zero human intervention.

Built for: Deriv AI Engineer Interview
Author: Sai Harshith

---

## Architecture

```
Yahoo Finance (yfinance)
        │
        ▼
┌─────────────────────────────────────────────────┐
│              RiskPulse AI Pipeline              │
│                                                 │
│  ┌──────────────┐    ┌──────────────┐           │
│  │ Volatility   │    │   Anomaly    │           │
│  │   Agent      │    │   Agent      │           │
│  │ (spike det.) │    │ (z-score)    │           │
│  └──────┬───────┘    └──────┬───────┘           │
│         │                   │                   │
│         └──────────┬────────┘                   │
│                    ▼                             │
│           ┌──────────────┐                      │
│           │  Risk Agent  │                      │
│           │ (0–100 score)│                      │
│           └──────┬───────┘                      │
│                  ▼                              │
│         ┌─────────────────┐                    │
│         │   Alert Agent   │  ← Claude AI        │
│         │ (LLM incident   │                    │
│         │    reports)     │                    │
│         └─────────────────┘                    │
└─────────────────────────────────────────────────┘
        │
        ▼
  FastAPI WebSocket  →  React Frontend (live dashboard)
```

---

## Agents

### 1. Volatility Agent (`agents/volatility_agent.py`)
- **Role**: Detects abnormal volatility spikes in price data
- **Method**: Rolling standard deviation of returns over 10 periods
- **Trigger**: Current volatility ≥ 2x the rolling average
- **Output**: `score` (0–100), `spike` (bool), `ratio`, `detail`

### 2. Anomaly Agent (`agents/anomaly_agent.py`)
- **Role**: Detects statistically unusual price movements
- **Method**: Z-score of most recent return vs. historical distribution
- **Trigger**: |Z-score| ≥ 2.5
- **Output**: `anomaly` (bool), `z_score`, `direction`, `score`

### 3. Risk Agent (`agents/risk_agent.py`)
- **Role**: Aggregates signals into a unified risk score
- **Method**: Weighted combination (volatility 60%, anomaly 40%)
- **Output**: `score` (0–100), `level` (LOW/MEDIUM/HIGH/CRITICAL), `color`, `flags`

### 4. Alert Agent (`agents/alert_agent.py`)
- **Role**: Generates human-readable incident reports using Claude AI
- **Model**: `claude-3-haiku-20240307` (fast + cost-efficient)
- **Trigger**: Only when risk flags are active
- **Output**: Incident report with what happened, why it matters, and recommended action

---

## Assets Monitored

| Ticker     | Asset         |
|------------|---------------|
| BTC-USD    | Bitcoin       |
| ETH-USD    | Ethereum      |
| GC=F       | Gold Futures  |
| EURUSD=X   | EUR/USD Forex |
| SPY        | S&P 500 ETF   |

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Data Source | Yahoo Finance (yfinance)            |
| Backend     | Python, FastAPI, WebSockets         |
| AI/LLM      | Anthropic Claude (claude-3-haiku)   |
| Stats       | pandas, numpy                       |
| Frontend    | React, Vite, TypeScript, Tailwind   |
| UI Library  | shadcn/ui (21st.dev style)          |
| Charts      | Recharts                            |
| Deploy BE   | Railway                             |
| Deploy FE   | Vercel                              |

---

## Skills & Rules for Development

### Skills
- **Autonomous Agent Design**: Multi-agent pipelines where each agent has a single responsibility
- **Real-time Systems**: WebSocket broadcasting, async background tasks
- **Statistical Finance**: Volatility modeling, Z-score anomaly detection
- **LLM Integration**: Claude API for natural language generation
- **Financial Data**: yfinance API usage, OHLCV data processing

### Rules
1. Each agent must be **single-responsibility** — one job per agent
2. The pipeline runs **every 60 seconds** in a background async loop
3. The Alert Agent **only fires when risk is triggered** (no unnecessary LLM calls)
4. All WebSocket messages follow the `{ type, assets, alerts, summary, last_updated }` schema
5. Frontend reconnects automatically if WebSocket drops
6. Never hardcode API keys — always use `.env`
7. Risk scores are **always 0–100**, never exceed bounds

### Environment Variables
```
ANTHROPIC_API_KEY=your_key_here
```

---

## Project Structure

```
project4/
├── CLAUDE.md              ← This file
├── backend/
│   ├── main.py            ← FastAPI app + WebSocket + pipeline orchestration
│   ├── data/
│   │   └── market_data.py ← yfinance data fetcher
│   ├── agents/
│   │   ├── volatility_agent.py
│   │   ├── anomaly_agent.py
│   │   ├── risk_agent.py
│   │   └── alert_agent.py
│   ├── .env               ← API keys (never commit)
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── components/
    │   └── hooks/
    ├── package.json
    └── vercel.json
```
