# RiskPulse AI — Technical Documentation

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Agent Pipeline](#3-agent-pipeline)
4. [API Reference](#4-api-reference)
5. [Data Models](#5-data-models)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Configuration](#7-configuration)
8. [Deployment](#8-deployment)

---

## 1. Project Overview

RiskPulse AI is an autonomous market risk monitoring platform built for financial trading environments. It continuously ingests live market data, runs it through a multi-agent analysis pipeline, and surfaces risk signals in real time through a live web dashboard.

The system operates without any human input after startup. Every 60 seconds, the pipeline runs autonomously across all monitored assets, computes risk scores, and broadcasts the results to all connected clients via WebSocket.

**Live URLs**
- Frontend: https://riskpulse-ai.vercel.app
- Backend API: https://riskpulse-ai-production.up.railway.app
- Health Check: https://riskpulse-ai-production.up.railway.app/health

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                       │
│                React Dashboard (Vercel)                 │
│         WebSocket connection with auto reconnect        │
└────────────────────────┬────────────────────────────────┘
                         │ wss://
┌────────────────────────▼────────────────────────────────┐
│                     BACKEND LAYER                       │
│                  FastAPI (Railway)                      │
│                                                         │
│   WebSocket Manager    │    REST Endpoints              │
│   /ws                  │    /health  /snapshot          │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    PIPELINE LAYER                       │
│          Async background loop every 60 seconds         │
│                                                         │
│   Volatility Agent   Anomaly Agent   Risk Agent         │
│         └──────────────┬──────────────┘                 │
│                        ▼                                │
│                   Alert Agent (LLM)                     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                      DATA LAYER                         │
│              Yahoo Finance via yfinance                 │
│         BTC  ETH  GOLD  EURUSD  SPY                     │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Agent Pipeline

The pipeline runs every 60 seconds as an async background task. Each asset goes through all 4 agents independently before results are aggregated and broadcast.

### Agent 1 — Volatility Agent

**File:** `backend/agents/volatility_agent.py`

**Purpose:** Detects abnormal spikes in price volatility by comparing the current rolling standard deviation against the historical average.

**Method:**
1. Computes percentage returns from closing prices
2. Calculates a 10-period rolling standard deviation
3. Compares the most recent volatility reading to the rolling mean
4. Computes a ratio of current vs average volatility

**Trigger condition:** Ratio greater than or equal to 0.8

**Output fields:**

| Field | Type | Description |
|-------|------|-------------|
| score | int | Risk contribution score 0 to 100 |
| spike | bool | Whether a volatility spike was detected |
| current_vol | float | Current volatility as a percentage |
| avg_vol | float | Average volatility as a percentage |
| ratio | float | Current volatility divided by average |
| detail | string | Human readable summary |

---

### Agent 2 — Anomaly Agent

**File:** `backend/agents/anomaly_agent.py`

**Purpose:** Detects statistically unusual price movements using Z-score analysis on the return distribution.

**Method:**
1. Computes percentage returns from closing prices
2. Calculates the mean and standard deviation of the return series
3. Computes the Z-score of the most recent return
4. Flags the move if the absolute Z-score exceeds the threshold

**Trigger condition:** Absolute Z-score greater than or equal to 0.5

**Output fields:**

| Field | Type | Description |
|-------|------|-------------|
| anomaly | bool | Whether an anomaly was detected |
| z_score | float | Z-score of the most recent return |
| last_return_pct | float | Most recent return as a percentage |
| score | int | Risk contribution score 0 to 100 |
| direction | string | upward or downward |
| detail | string | Human readable summary |

---

### Agent 3 — Risk Agent

**File:** `backend/agents/risk_agent.py`

**Purpose:** Aggregates outputs from the Volatility Agent and Anomaly Agent into a unified risk score and severity level.

**Method:** Weighted combination of both agent scores.

```
risk_score = (volatility_score × 0.6) + (anomaly_score × 0.4)
```

**Risk levels:**

| Score Range | Level | Color |
|-------------|-------|-------|
| 0 to 14 | LOW | Green |
| 15 to 34 | MEDIUM | Yellow |
| 35 to 54 | HIGH | Orange |
| 55 to 100 | CRITICAL | Red |

**Output fields:**

| Field | Type | Description |
|-------|------|-------------|
| score | int | Aggregated risk score 0 to 100 |
| level | string | LOW, MEDIUM, HIGH, or CRITICAL |
| color | string | green, yellow, orange, or red |
| flags | list | Active flags such as volatility_spike or price_anomaly |
| triggered | bool | Whether any risk flags are active |

---

### Agent 4 — Alert Agent

**File:** `backend/agents/alert_agent.py`

**Purpose:** Generates human readable incident reports using a large language model when risk is triggered. Only fires when the Risk Agent has active flags, avoiding unnecessary LLM calls.

**Model:** Nvidia Nemotron Super 120B via OpenRouter API

**Trigger condition:** Risk agent triggered flag is true

**Prompt structure:**
- Asset name, ticker, and current price
- Risk score and level
- Volatility analysis summary
- Anomaly analysis summary
- Instructions to generate a concise 3-part report

**Output fields:**

| Field | Type | Description |
|-------|------|-------------|
| generated | bool | Whether an LLM report was generated |
| message | string | The full incident report text |
| recommendation | string | Action recommendation |
| severity | string | Mirrors the risk level |

**Fallback behavior:** If the LLM call fails for any reason, the agent falls back to a rule-based template using the raw signal data, ensuring the system never silently fails.

---

## 4. API Reference

### GET /health

Returns the service status.

**Response:**
```json
{
  "status": "ok",
  "service": "RiskPulse AI"
}
```

---

### GET /snapshot

Returns the latest pipeline snapshot without requiring a WebSocket connection.

**Response:**
```json
{
  "type": "snapshot",
  "assets": [...],
  "alerts": [...],
  "summary": {
    "total_assets": 5,
    "critical": 1,
    "high": 2,
    "medium": 1,
    "low": 1
  },
  "last_updated": "2026-04-13T10:00:00.000000"
}
```

---

### WebSocket /ws

Real-time endpoint. Connects and receives a snapshot immediately, then receives updates every 60 seconds.

**Connection:**
```
wss://riskpulse-ai-production.up.railway.app/ws
```

**Message types:**

| Type | When | Description |
|------|------|-------------|
| loading | On connect, no data yet | Pipeline is initializing |
| snapshot | On connect and every 60s | Full asset and alert data |

---

## 5. Data Models

### Asset Object

```json
{
  "ticker": "BTC-USD",
  "name": "Bitcoin",
  "price": 71101.75,
  "risk": {
    "score": 42,
    "level": "HIGH",
    "color": "orange",
    "flags": ["volatility_spike"],
    "triggered": true
  },
  "volatility": {
    "score": 55,
    "spike": true,
    "current_vol": 0.8234,
    "avg_vol": 0.4012,
    "ratio": 2.05,
    "detail": "Volatility is 2.1x the 10-period average"
  },
  "anomaly": {
    "anomaly": false,
    "z_score": -0.82,
    "last_return_pct": -0.129,
    "score": 16,
    "direction": "downward",
    "detail": "Z-score of -0.82 detected (downward move)"
  },
  "alert": {
    "generated": true,
    "message": "Bitcoin is experiencing elevated volatility...",
    "recommendation": "Review exposure and apply risk controls.",
    "severity": "HIGH"
  },
  "timestamp": "2026-04-13T10:00:00.000000"
}
```

### Alert Object

```json
{
  "ticker": "BTC-USD",
  "name": "Bitcoin",
  "level": "HIGH",
  "score": 42,
  "message": "Bitcoin is experiencing elevated volatility...",
  "timestamp": "2026-04-13T10:00:00.000000"
}
```

---

## 6. Frontend Architecture

### Component Tree

```
App.tsx
├── SummaryBar          — Risk level count overview (Critical/High/Medium/Low)
├── AssetCard (x5)      — Per asset card with price, risk meter, stats, alert
│   ├── Badge           — Risk level badge with color coding
│   └── RiskMeter       — Animated circular gauge showing score 0 to 100
├── AlertFeed           — Live AI generated alert panel
└── Agents Panel        — Static panel showing 4 running agents
```

### WebSocket Hook

**File:** `frontend/src/hooks/useWebSocket.ts`

Manages the WebSocket lifecycle with automatic reconnection on disconnect. Retries every 5 seconds. Exposes connection status as connecting, connected, disconnected, or error.

### Environment Variables

| Variable | Description |
|----------|-------------|
| VITE_WS_URL | WebSocket backend URL. Uses wss:// in production |

---

## 7. Configuration

### Assets Monitored

Configured in `backend/data/market_data.py`. To add or remove assets, update the ASSETS dictionary:

```python
ASSETS = {
    "BTC-USD":  "Bitcoin",
    "ETH-USD":  "Ethereum",
    "GC=F":     "Gold",
    "EURUSD=X": "EUR/USD",
    "SPY":      "S&P 500",
}
```

### Pipeline Interval

Configured in `backend/main.py`. Default is 60 seconds:

```python
await asyncio.sleep(60)
```

### Risk Thresholds

| Setting | Location | Default |
|---------|----------|---------|
| Volatility spike ratio | volatility_agent.py | 0.8x |
| Anomaly Z-score | anomaly_agent.py | 0.5 |
| CRITICAL threshold | risk_agent.py | 55 |
| HIGH threshold | risk_agent.py | 35 |
| MEDIUM threshold | risk_agent.py | 15 |

---

## 8. Deployment

| Service | Platform | Purpose |
|---------|----------|---------|
| Frontend | Vercel | React dashboard, auto deploys on push to main |
| Backend | Railway | FastAPI server, WebSocket, agent pipeline |

**Environment variables required on Railway:**

| Key | Description |
|-----|-------------|
| OPENROUTER_API_KEY | API key for LLM access via OpenRouter |

**Environment variables required on Vercel:**

| Key | Description |
|-----|-------------|
| VITE_WS_URL | WebSocket URL pointing to Railway backend |

Both services auto deploy when changes are pushed to the main branch on GitHub.
