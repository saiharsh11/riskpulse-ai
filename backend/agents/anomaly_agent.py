import pandas as pd


def detect_anomalies(df: pd.DataFrame) -> dict:
    """
    Uses Z-score to detect price anomalies in recent candles.
    Flags anomaly if last candle's return exceeds 2.5 std deviations.
    """
    if df.empty or len(df) < 15:
        return {"anomaly": False, "z_score": 0, "score": 0, "detail": "Insufficient data"}

    close = df["Close"].squeeze()
    returns = close.pct_change().dropna()

    mean = returns.mean()
    std = returns.std()

    if std == 0:
        return {"anomaly": False, "z_score": 0, "score": 0, "detail": "No variation in returns"}

    last_return = float(returns.iloc[-1])
    z_score = (last_return - mean) / std

    anomaly = abs(z_score) >= 0.5

    # Score based on z-score magnitude
    score = min(int((abs(z_score) / 5.0) * 100), 100)

    direction = "upward" if last_return > 0 else "downward"

    return {
        "anomaly": anomaly,
        "z_score": round(z_score, 2),
        "last_return_pct": round(last_return * 100, 3),
        "score": score,
        "direction": direction,
        "detail": f"Z-score of {round(z_score, 2)} detected ({direction} move)",
    }
