import pandas as pd


def analyze_volatility(df: pd.DataFrame) -> dict:
    """
    Calculates rolling volatility and detects spikes.
    Returns volatility score and whether a spike is detected.
    """
    if df.empty or len(df) < 10:
        return {"score": 0, "spike": False, "current_vol": 0, "avg_vol": 0, "detail": "Insufficient data"}

    close = df["Close"].squeeze()
    returns = close.pct_change().dropna()

    # Rolling volatility (std of returns)
    rolling_vol = returns.rolling(window=10).std()
    current_vol = float(rolling_vol.iloc[-1]) if not rolling_vol.empty else 0
    avg_vol = float(rolling_vol.mean())

    if avg_vol == 0:
        return {"score": 0, "spike": False, "current_vol": 0, "avg_vol": 0, "detail": "No volatility data"}

    ratio = current_vol / avg_vol

    # Spike if current volatility is above average at all
    spike = ratio >= 0.8

    # Score 0–100
    score = min(int((ratio / 1.5) * 100), 100)

    return {
        "score": score,
        "spike": spike,
        "current_vol": round(current_vol * 100, 4),
        "avg_vol": round(avg_vol * 100, 4),
        "ratio": round(ratio, 2),
        "detail": f"Volatility is {round(ratio, 1)}x the 10-period average",
    }
