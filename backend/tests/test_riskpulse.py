"""Offline checks for RiskPulse AI: guardrails, evidence tracking and the API shape. No network, no model calls."""
from fastapi.testclient import TestClient

from riskpulse import api
from riskpulse.agents import BANDS, _evidence_tools, check_rating

GOOD = {
    "level": "HIGH", "score": 62, "daily_swing_pct": 1.4, "confidence": "medium",
    "summary": "Bigger swings than usual this week.",
    "reasons": [{"claim": "30-day average move 1.4% vs 1.0% usual", "tool": "daily_moves"}],
}


def test_good_rating_passes():
    assert check_rating(GOOD, {"daily_moves"}) == []


def test_score_must_match_level_band():
    bad = {**GOOD, "score": 90}
    assert any("within 50-74" in p for p in check_rating(bad, {"daily_moves"}))
    for level, (lo, hi) in BANDS.items():
        assert check_rating({**GOOD, "level": level, "score": lo}, {"daily_moves"}) == []
        assert check_rating({**GOOD, "level": level, "score": hi}, {"daily_moves"}) == []


def test_non_numeric_score_and_missing_summary_rejected():
    problems = check_rating({**GOOD, "score": "thirty", "summary": ""}, {"daily_moves"})
    assert any("score must be a number" in p for p in problems)
    assert any("summary" in p for p in problems)


def test_reason_needs_a_tool_that_returned_evidence():
    assert any("not backed" in p for p in check_rating(GOOD, set()))


def test_advice_is_blocked():
    advice = {**GOOD, "summary": "You should buy Bitcoin now."}
    assert any("advice" in p for p in check_rating(advice, {"daily_moves"}))


def test_empty_or_failed_tools_are_not_evidence():
    trace = [
        {"kind": "tool", "tool": "daily_moves", "result": '{"asset":"BTC-USD","recent_average_abs_move_pct":1.4}'},
        {"kind": "tool", "tool": "track_record", "result": '{"ratings":[],"note":"no graded history yet"}'},
        {"kind": "tool", "tool": "find_periods", "result": '{"error":"ValueError: bad asset"}'},
        {"kind": "answer", "model": "x", "text": "{}"},
    ]
    assert _evidence_tools(trace) == {"daily_moves"}


def test_board_endpoint_shape(monkeypatch):
    monkeypatch.setitem(api.STATE, "status", "ready")
    monkeypatch.setitem(api.STATE, "results", [{"asset": "SPY", "name": "S&P 500", "rating": GOOD, "critic": {"verdict": "accept"},
                                                 "guardrail_problems": [], "trace": [], "secret_field": "hidden"}])
    client = TestClient(api.app)  # no `with`: the startup scheduler (which calls the models) is not run
    body = client.get("/api/board").json()
    assert body["status"] == "ready"
    assert body["results"][0]["rating"]["score"] == 62
    assert "secret_field" not in body["results"][0]  # only whitelisted fields leave the server
    assert client.get("/health").json()["status"] == "ok"
