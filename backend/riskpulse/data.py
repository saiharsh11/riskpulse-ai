"""
Market data, held in memory only.

Prices are fetched from Yahoo Finance's public chart endpoint (standard library only), with yfinance
as a fallback, on first use and kept in a dict for the life
of the process. Nothing is written to disk by this module; yfinance's own small cookie/timezone
cache is pointed at a temporary folder that the caller deletes when the run ends.
"""
from __future__ import annotations

import math
from datetime import date

ASSETS: dict[str, str] = {
    "SPY": "S&P 500",
    "BTC-USD": "Bitcoin",
    "ETH-USD": "Ethereum",
    "GC=F": "Gold",
    "EURUSD=X": "EUR/USD",
}

_closes: dict[str, list[tuple[date, float]]] = {}


def _fetch_direct(asset: str) -> list[tuple[date, float]]:
    """10 years of daily closes from Yahoo's chart endpoint, using only the standard library."""
    import json
    import urllib.parse
    import urllib.request
    from datetime import datetime, timezone
    url = (f"https://query1.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(asset)}"
           "?range=10y&interval=1d&events=div,splits")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (RiskPulse-AI research project)"})
    import ssl
    try:  # explicit CA bundle: the MCP server runs with a minimal environment
        import certifi
        ctx = ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=20, context=ctx) as resp:
        res = json.loads(resp.read())["chart"]["result"][0]
    ind = res["indicators"]
    vals = (ind.get("adjclose") or [{}])[0].get("adjclose") or ind["quote"][0]["close"]
    out = [(datetime.fromtimestamp(t, timezone.utc).date(), float(v))
           for t, v in zip(res["timestamp"], vals) if v is not None]
    if len(out) < 100:
        raise RuntimeError(f"too little price data for {asset}")
    return out


def preload_all() -> dict[str, str]:
    """Fetch all 5 markets, one request at a time (parallel requests get rejected).
    Direct endpoint first; anything still missing falls back to yfinance."""
    status: dict[str, str] = {}
    for a in ASSETS:
        if a in _closes:
            status[a] = "ok (cached)"
            continue
        try:
            _closes[a] = _fetch_direct(a)
            status[a] = "ok"
        except Exception:
            pass
    if all(a in _closes for a in ASSETS):
        return status
    import yfinance as yf
    try:
        df = yf.download(list(ASSETS), period="10y", interval="1d", progress=False, auto_adjust=True,
                         group_by="ticker", threads=False)
        for a in (x for x in ASSETS if x not in _closes):
            try:
                s = df[a]["Close"].dropna()
                if len(s):
                    _closes[a] = [(ts.date(), float(v)) for ts, v in s.items()]
                    status[a] = "ok"
            except Exception:
                pass
    except Exception:
        pass
    for a in ASSETS:
        if a not in _closes:
            try:
                closes(a)
                status[a] = "ok (single)"
            except Exception as e:
                status[a] = f"unavailable: {e}"[:100]
    return status


def closes(asset: str) -> list[tuple[date, float]]:
    """Daily closing prices, oldest first (fetched once, then served from memory)."""
    if asset not in ASSETS:
        raise ValueError(f"unknown asset {asset!r}; choose one of {list(ASSETS)}")
    if asset not in _closes:
        try:
            _closes[asset] = _fetch_direct(asset)
            return _closes[asset]
        except Exception:
            pass
        import time
        import yfinance as yf
        df = None
        for attempt in range(4):  # Yahoo occasionally times out on the first request
            df = yf.download(asset, period="10y", interval="1d", progress=False, auto_adjust=True)
            if df is not None and not df.empty:
                break
            time.sleep(1.5 * (attempt + 1))
        if df is None or df.empty:
            raise RuntimeError(f"no price data returned for {asset}")
        col = df["Close"]
        if hasattr(col, "columns"):  # multi-index columns in yfinance 1.x
            col = col.iloc[:, 0]
        _closes[asset] = [(ts.date(), float(v)) for ts, v in col.dropna().items()]
    return _closes[asset]


def moves(asset: str) -> list[tuple[date, float]]:
    """Daily % moves, oldest first."""
    c = closes(asset)
    return [(c[i][0], (c[i][1] / c[i - 1][1] - 1) * 100) for i in range(1, len(c))]


def median(xs: list[float]) -> float:
    s = sorted(xs)
    n = len(s)
    if n == 0:
        return float("nan")
    return s[n // 2] if n % 2 else (s[n // 2 - 1] + s[n // 2]) / 2


def r(x: float, nd: int = 2) -> float | None:
    return None if x is None or (isinstance(x, float) and math.isnan(x)) else round(float(x), nd)
