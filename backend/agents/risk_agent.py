def calculate_risk(volatility_result: dict, anomaly_result: dict) -> dict:
    """
    Aggregates signals from Volatility Agent and Anomaly Agent
    into a single risk score (0–100) with severity level.
    """
    vol_score = volatility_result.get("score", 0)
    anom_score = anomaly_result.get("score", 0)

    # Weighted aggregate: volatility 60%, anomaly 40%
    risk_score = int(vol_score * 0.6 + anom_score * 0.4)
    risk_score = max(0, min(risk_score, 100))

    # Determine risk level
    if risk_score >= 55:
        level = "CRITICAL"
        color = "red"
    elif risk_score >= 35:
        level = "HIGH"
        color = "orange"
    elif risk_score >= 15:
        level = "MEDIUM"
        color = "yellow"
    else:
        level = "LOW"
        color = "green"

    flags = []
    if volatility_result.get("spike"):
        flags.append("volatility_spike")
    if anomaly_result.get("anomaly"):
        flags.append("price_anomaly")

    return {
        "score": risk_score,
        "level": level,
        "color": color,
        "flags": flags,
        "triggered": len(flags) > 0,
    }
