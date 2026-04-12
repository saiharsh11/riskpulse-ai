import asyncio
import json
from datetime import datetime
from typing import List
import numpy as np


class NumpyEncoder(json.JSONEncoder):
    """Converts numpy types to native Python types for JSON serialization."""
    def default(self, obj):
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from data.market_data import fetch_all_assets
from agents.volatility_agent import analyze_volatility
from agents.anomaly_agent import detect_anomalies
from agents.risk_agent import calculate_risk
from agents.alert_agent import generate_alert

app = FastAPI(title="RiskPulse AI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connected WebSocket clients
active_connections: List[WebSocket] = []

# Latest snapshot cache
latest_snapshot: dict = {}


async def broadcast(data: dict):
    payload = json.dumps(data, cls=NumpyEncoder)
    disconnected = []
    for ws in active_connections:
        try:
            await ws.send_text(payload)
        except Exception:
            disconnected.append(ws)
    for ws in disconnected:
        active_connections.remove(ws)


def run_pipeline() -> dict:
    """
    Core RiskPulse AI pipeline:
    1. Fetch market data (yfinance)
    2. Volatility Agent — detect spikes
    3. Anomaly Agent   — detect price anomalies
    4. Risk Agent      — compute risk score
    5. Alert Agent     — generate LLM incident report
    """
    print(f"[Pipeline] Running at {datetime.utcnow().isoformat()}")
    assets_data = fetch_all_assets()

    results = []
    alerts = []

    for ticker, asset in assets_data.items():
        df = asset["df"]
        name = asset["name"]
        price = asset["price"]

        volatility = analyze_volatility(df)
        anomaly = detect_anomalies(df)
        risk = calculate_risk(volatility, anomaly)
        alert = generate_alert(name, ticker, price, risk, volatility, anomaly)

        asset_result = {
            "ticker": ticker,
            "name": name,
            "price": price,
            "risk": risk,
            "volatility": volatility,
            "anomaly": anomaly,
            "alert": alert,
            "timestamp": datetime.utcnow().isoformat(),
        }
        results.append(asset_result)

        if risk["triggered"]:
            alerts.append({
                "ticker": ticker,
                "name": name,
                "level": risk["level"],
                "score": risk["score"],
                "message": alert["message"],
                "timestamp": datetime.utcnow().isoformat(),
            })

    # Sort by risk score descending
    results.sort(key=lambda x: x["risk"]["score"], reverse=True)
    alerts.sort(key=lambda x: x["score"], reverse=True)

    snapshot = {
        "type": "snapshot",
        "assets": results,
        "alerts": alerts,
        "summary": {
            "total_assets": len(results),
            "critical": sum(1 for r in results if r["risk"]["level"] == "CRITICAL"),
            "high": sum(1 for r in results if r["risk"]["level"] == "HIGH"),
            "medium": sum(1 for r in results if r["risk"]["level"] == "MEDIUM"),
            "low": sum(1 for r in results if r["risk"]["level"] == "LOW"),
        },
        "last_updated": datetime.utcnow().isoformat(),
    }
    return snapshot


async def monitor_loop():
    """Background loop: runs pipeline every 60 seconds and broadcasts to clients."""
    global latest_snapshot
    while True:
        try:
            snapshot = run_pipeline()
            latest_snapshot = snapshot
            await broadcast(snapshot)
            print(f"[Monitor] Broadcast complete — {len(active_connections)} clients connected")
        except Exception as e:
            print(f"[Monitor] Pipeline error: {e}")
        await asyncio.sleep(60)


@app.on_event("startup")
async def startup():
    asyncio.create_task(monitor_loop())


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    print(f"[WS] Client connected. Total: {len(active_connections)}")

    # Send latest cached snapshot immediately on connect
    if latest_snapshot:
        await websocket.send_text(json.dumps(latest_snapshot, cls=NumpyEncoder))
    else:
        await websocket.send_text(json.dumps({"type": "loading", "message": "Fetching market data..."}))

    try:
        while True:
            await websocket.receive_text()  # keep connection alive
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        print(f"[WS] Client disconnected. Total: {len(active_connections)}")


@app.get("/health")
def health():
    return {"status": "ok", "service": "RiskPulse AI"}


@app.get("/snapshot")
def snapshot():
    return latest_snapshot or {"message": "No data yet, pipeline starting..."}
