"""
One-off test run: rate markets with real data and free OpenRouter models, print the results.
Nothing is saved anywhere.

    python -m riskpulse.test_run BTC-USD GC=F      # specific markets
    python -m riskpulse.test_run                   # all 5
"""
from __future__ import annotations

import asyncio
import sys
import time

from riskpulse.agents import Meter, run
from riskpulse.data import ASSETS


def main() -> None:
    picks = [a for a in sys.argv[1:] if a in ASSETS] or list(ASSETS)
    meter = Meter()
    t0 = time.time()
    results = asyncio.run(run({a: ASSETS[a] for a in picks}, meter))
    for r in results:
        print("=" * 72)
        print(f"{r['name']} ({r['asset']})")
        if r.get("error"):
            print("  ERROR:", r["error"])
        for t in r.get("trace", []):
            if t["kind"] == "tool":
                print(f"  [{t['agent']}] tool {t['tool']}({t['args']}) -> {t['result'][:160]}")
            else:
                print(f"  [{t['agent']}] ({t['model']}) {t['text'][:400]}")
        rt = r.get("rating") or {}
        print(f"  >>> RATING: {rt.get('level')} | swing ±{rt.get('daily_swing_pct')}% | confidence {rt.get('confidence')}")
        for x in rt.get("reasons", []):
            print(f"      - {x.get('claim')}  [{x.get('tool')}]")
        print(f"  >>> CRITIC: {r.get('critic')} | guardrail problems: {r.get('guardrail_problems') or 'none'}")
    print("=" * 72)
    print(f"USAGE: {meter.calls} model calls · {meter.tokens:,} tokens "
          f"({meter.prompt_tokens:,} in / {meter.completion_tokens:,} out) · by agent {meter.by_agent} · {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
