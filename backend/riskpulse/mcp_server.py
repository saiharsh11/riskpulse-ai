"""
RiskPulse MCP server: 4 read-only tools.

Tools return data only (moves, comparisons, historical matches, past ratings); they never decide
a risk level. Agents decide. No tool can read local files, write anything, or reach anything other
than public market prices.

Run (stdio):  python -m riskpulse.mcp_server
"""
from __future__ import annotations

import os
import tempfile

from mcp.server.mcpserver import MCPServer

from riskpulse import data
from riskpulse.data import ASSETS, median, moves, r

# yfinance keeps a tiny cookie/timezone cache; point it at a throwaway folder (deleted on exit)
_tmp = tempfile.TemporaryDirectory(prefix="riskpulse-")
try:
    import yfinance as yf
    yf.set_tz_cache_location(_tmp.name)
except Exception:
    pass

server = MCPServer(
    name="riskpulse",
    instructions="Read-only market data tools for RiskPulse AI agents. Tools return facts, never decisions.",
)

_ratings_store: dict[str, list[dict]] = {}  # filled by the backend later; empty in this test


def _check(asset: str) -> None:
    if asset not in ASSETS:
        raise ValueError(f"unknown asset {asset!r}; choose one of {list(ASSETS)}")


def _safe(fn):
    """Tools never crash: errors come back as a short, readable reason for the agent."""
    import functools

    @functools.wraps(fn)
    def wrapper(*a, **k):
        try:
            return fn(*a, **k)
        except Exception as e:
            return {"error": f"{type(e).__name__}: {e}"[:200]}
    return wrapper


def preload() -> dict:
    """Fetch all 5 markets once at start-up (into memory), retrying slow first requests."""
    return data.preload_all()


@server.tool(description="Recent daily % moves of one market vs its long-run typical move. exclude_top drops the N biggest days.")
@_safe
def daily_moves(asset: str, days: int = 30, exclude_top: int = 0) -> dict:
    _check(asset)
    days = max(5, min(int(days), 90))
    m = moves(asset)
    recent = m[-days:]
    ranked = sorted(recent, key=lambda x: abs(x[1]), reverse=True)
    dropped = {d for d, _ in ranked[: max(0, int(exclude_top))]}
    kept = [x for x in recent if x[0] not in dropped]
    abs_kept = [abs(v) for _, v in kept]
    long_run = median([abs(v) for _, v in m])
    return {
        "asset": asset, "name": ASSETS[asset], "days": days, "excluded_biggest_days": len(dropped),
        "recent_typical_abs_move_pct": r(median(abs_kept)),
        "recent_average_abs_move_pct": r(sum(abs_kept) / len(abs_kept)) if abs_kept else None,
        "long_run_typical_abs_move_pct": r(long_run),
        "biggest_moves": [{"date": str(d), "move_pct": r(v)} for d, v in ranked[:3]],
        "last_5_days_pct": [r(v) for _, v in recent[-5:]],
    }


@server.tool(description="All 5 markets side by side: recent average absolute daily move vs long-run typical, and total change.")
@_safe
def compare_assets(days: int = 10) -> dict:
    days = max(3, min(int(days), 60))
    out = {}
    for a in ASSETS:
        m = moves(a)
        recent = [abs(v) for _, v in m[-days:]]
        c = data.closes(a)
        out[ASSETS[a]] = {
            "asset": a,
            "recent_average_abs_move_pct": r(sum(recent) / len(recent)),
            "long_run_typical_abs_move_pct": r(median([abs(v) for _, v in m])),
            "total_change_pct": r((c[-1][1] / c[-1 - days][1] - 1) * 100),
        }
    return {"days": days, "markets": out}


@server.tool(description="Find past dates matching YOUR condition (move >= min_abs_move_pct for consecutive_days days, direction down/up/any) and how rough the following 5 days were vs typical.")
@_safe
def find_periods(asset: str, min_abs_move_pct: float, consecutive_days: int = 1, direction: str = "any") -> dict:
    _check(asset)
    if direction not in ("down", "up", "any"):
        raise ValueError("direction must be 'down', 'up' or 'any'")
    k = max(1, min(int(consecutive_days), 10))
    thr = float(min_abs_move_pct)
    m = moves(asset)
    long_run = median([abs(v) for _, v in m])

    def hit(v: float) -> bool:
        if direction == "down":
            return v <= -thr
        if direction == "up":
            return v >= thr
        return abs(v) >= thr

    matches, i = [], k - 1
    while i < len(m) - 5:
        if all(hit(m[j][1]) for j in range(i - k + 1, i + 1)):
            nxt = [abs(v) for _, v in m[i + 1: i + 6]]
            avg = sum(nxt) / len(nxt)
            matches.append({"date": str(m[i][0]), "next_week_avg_abs_move_pct": r(avg), "vs_long_run_typical": r(avg / long_run)})
            i += 5  # don't count the same episode twice
        i += 1
    rougher = sum(1 for x in matches if x["vs_long_run_typical"] and x["vs_long_run_typical"] > 1.5)
    return {
        "asset": asset, "condition": {"min_abs_move_pct": thr, "consecutive_days": k, "direction": direction},
        "long_run_typical_abs_move_pct": r(long_run),
        "matches_found": len(matches),
        "next_week_rougher_than_1_5x_typical": rougher,
        "most_recent_matches": [{"date": x["date"], "next_week_vs_typical": x["vs_long_run_typical"]} for x in matches[-4:]],
    }


@server.tool(description="Past ratings, Judge grades and lessons for this market.")
@_safe
def track_record(asset: str) -> dict:
    _check(asset)
    past = _ratings_store.get(asset, [])
    return {"asset": asset, "ratings": past, "lessons": [], "note": "no graded history yet" if not past else ""}


if __name__ == "__main__":
    preload()
    try:
        server.run("stdio")
    finally:
        _tmp.cleanup()
