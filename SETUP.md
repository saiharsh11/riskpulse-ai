# RiskPulse AI — Setup & Deployment Guide

## Prerequisites
- Python 3.10+
- Node.js 18+
- An Anthropic API key → get one at console.anthropic.com
- A Railway account → railway.app (free tier is fine)
- A Vercel account → vercel.com (free tier is fine)

---

## 1. Run Locally

### Backend
```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Open .env and add your Anthropic API key

# Start the server
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
WebSocket at: ws://localhost:8000/ws
Health check: http://localhost:8000/health

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Create .env file
cp .env.example .env.local
# .env.local already has: VITE_WS_URL=ws://localhost:8000/ws

# Start dev server
npm run dev
```

Frontend runs at: http://localhost:3000

---

## 2. Deploy Backend on Railway

1. Go to railway.app → New Project → Deploy from GitHub repo
2. Select the `backend/` folder as root directory
3. Railway auto-detects Python. Set start command:
   ```
   uvicorn main:app --host 0.0.0.0 --port $PORT
   ```
4. Add environment variable:
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```
5. Deploy → copy the generated URL (e.g. `https://riskpulse-production.up.railway.app`)

---

## 3. Deploy Frontend on Vercel

1. Go to vercel.com → New Project → Import GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework preset: **Vite**
4. Add environment variable:
   ```
   VITE_WS_URL=wss://riskpulse-production.up.railway.app/ws
   ```
   (Note: use `wss://` not `ws://` for production)
5. Deploy → your app is live!

---

## 4. Project Structure

```
project4/
├── CLAUDE.md              ← Architecture + agent docs
├── SETUP.md               ← This file
├── backend/
│   ├── main.py            ← FastAPI + WebSocket orchestrator
│   ├── data/
│   │   └── market_data.py ← yfinance fetcher
│   ├── agents/
│   │   ├── volatility_agent.py  ← Detects volatility spikes
│   │   ├── anomaly_agent.py     ← Z-score anomaly detection
│   │   ├── risk_agent.py        ← Risk score aggregation
│   │   └── alert_agent.py       ← Claude AI incident reports
│   ├── .env.example
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx               ← Main dashboard
    │   ├── hooks/useWebSocket.ts ← WS with auto-reconnect
    │   └── components/
    │       ├── AssetCard.tsx     ← Per-asset risk card
    │       ├── AlertFeed.tsx     ← Live alert panel
    │       ├── SummaryBar.tsx    ← Overview stats
    │       ├── RiskMeter.tsx     ← Circular risk gauge
    │       └── Badge.tsx         ← Risk level badge
    ├── vercel.json
    └── package.json
```

---

## 5. How the Pipeline Works

Every 60 seconds the system autonomously:
1. Fetches live OHLCV data for 5 assets via Yahoo Finance
2. **Volatility Agent** computes rolling std deviation → flags spikes
3. **Anomaly Agent** computes Z-scores → flags unusual price moves
4. **Risk Agent** aggregates both signals → risk score (0–100)
5. **Alert Agent** calls Claude AI → generates incident report if risk triggered
6. Broadcasts full snapshot via WebSocket to all connected clients
