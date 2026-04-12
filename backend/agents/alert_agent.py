import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY"),
)


def generate_alert(asset_name: str, ticker: str, price: float, risk: dict, volatility: dict, anomaly: dict) -> dict:
    """
    Uses Claude to autonomously generate a human-readable incident report
    based on risk signals detected for the asset.
    """
    if not risk.get("triggered"):
        return {
            "generated": False,
            "message": f"{asset_name} is operating within normal parameters.",
            "recommendation": "No action required.",
            "severity": "LOW",
        }

    prompt = f"""You are an autonomous risk monitoring AI for a financial trading platform called RiskPulse AI.

Analyze the following real-time risk signals for {asset_name} ({ticker}) and generate a concise incident report.

Current Price: ${price}
Risk Score: {risk['score']}/100
Risk Level: {risk['level']}
Active Flags: {', '.join(risk['flags']) if risk['flags'] else 'None'}

Volatility Analysis:
- Current Volatility: {volatility.get('current_vol', 0)}%
- Average Volatility: {volatility.get('avg_vol', 0)}%
- Volatility Ratio: {volatility.get('ratio', 0)}x average
- Spike Detected: {volatility.get('spike', False)}

Anomaly Analysis:
- Anomaly Detected: {anomaly.get('anomaly', False)}
- Z-Score: {anomaly.get('z_score', 0)}
- Last Move: {anomaly.get('last_return_pct', 0)}% ({anomaly.get('direction', 'unknown')})

Write a concise incident report with:
1. What is happening (1-2 sentences)
2. Why this is significant (1 sentence)
3. Recommended action for traders (1 sentence)

Keep it professional, factual, and under 100 words total. Do not use bullet points, just plain paragraphs."""

    try:
        response = client.chat.completions.create(
            model="nvidia/nemotron-3-super-120b-a12b:free",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}],
        )
        report_text = response.choices[0].message.content.strip()

        return {
            "generated": True,
            "message": report_text,
            "recommendation": "Review positions and apply risk controls.",
            "severity": risk["level"],
        }
    except Exception as e:
        print(f"[AlertAgent] LLM error: {e}")
        flags_str = ", ".join(risk["flags"]) if risk["flags"] else "anomalous behavior"
        return {
            "generated": True,
            "message": f"{asset_name} showing {flags_str}. Risk score: {risk['score']}/100. Current price: ${price}.",
            "recommendation": "Review exposure and apply risk controls.",
            "severity": risk["level"],
        }
