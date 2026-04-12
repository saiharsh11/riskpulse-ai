import yfinance as yf
import pandas as pd
from datetime import datetime

ASSETS = {
    "BTC-USD": "Bitcoin",
    "ETH-USD": "Ethereum",
    "GC=F": "Gold",
    "EURUSD=X": "EUR/USD",
    "SPY": "S&P 500",
}


def fetch_asset_data(ticker: str, period: str = "5d", interval: str = "1h") -> pd.DataFrame:
    try:
        df = yf.download(ticker, period=period, interval=interval, progress=False)
        # yfinance 1.x returns multi-level columns — flatten them
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)
        df.dropna(inplace=True)
        return df
    except Exception as e:
        print(f"[MarketData] Error fetching {ticker}: {e}")
        return pd.DataFrame()


def fetch_current_price(ticker: str) -> float:
    try:
        t = yf.Ticker(ticker)
        info = t.fast_info
        return round(float(info.last_price), 4)
    except Exception:
        return 0.0


def fetch_all_assets() -> dict:
    result = {}
    for ticker, name in ASSETS.items():
        df = fetch_asset_data(ticker)
        price = fetch_current_price(ticker)
        result[ticker] = {
            "name": name,
            "ticker": ticker,
            "price": price,
            "df": df,
        }
    return result
