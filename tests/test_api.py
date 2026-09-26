"""App read routes return the shapes the contract/mocks promise. Repo reads are monkeypatched,
so these run offline and assert the wiring + response envelope, not Snowflake."""
import pytest
from fastapi.testclient import TestClient

from server.main import app
from server import repo, store

client = TestClient(app)

FAKE_TODAY = {
    "person_id": "p_demo", "name": "Maria R.", "as_of": "2022-01-22", "status": "heads_up",
    "baseline_ready": True, "baseline_days_remaining": 0, "baseline": 42,
    "headline": "This week could be a heavier stretch than usual.",
    "series": [{"date": "2022-01-22", "actual": 61, "forecast": 61, "lower": 61, "upper": 61}],
    "drivers": [{"label": "Sleep", "detail": "down about 50 min vs your usual", "direction": "worse"}],
}


@pytest.fixture(autouse=True)
def _mock_repo(monkeypatch, tmp_path):
    monkeypatch.setattr(repo, "today", lambda pid: dict(FAKE_TODAY, person_id=pid))
    monkeypatch.setattr(repo, "headsup", lambda pid: {
        "person_id": pid, "status": "heads_up", "note": "n", "note_disclaimer": "AI-written, not medical advice.",
        "programs": [], "crisis_note": "call or text 988"})
    monkeypatch.setattr(repo, "metrics", lambda pid: {
        "person_id": pid, "as_of": "2021-07-29", "metrics": [
            {"key": "resting_hr", "label": "Resting heart rate", "unit": "bpm", "latest": 62,
             "baseline": 61, "direction": "worse", "low_data": False,
             "series": [{"date": "2021-07-28", "value": 61}, {"date": "2021-07-29", "value": 62}]}]})
    monkeypatch.setattr(repo, "cohort_summary", lambda: {
        "enrolled": 51, "steady": 34, "building": 4, "heads_up": 13, "contacted_this_week": 2,
        "updated_at": "2026-09-26T00:00:00Z"})
    monkeypatch.setattr(repo, "cohort_caregivers", lambda **k: {"caregivers": [
        {"person_id": "p1", "name": "A B.", "status": "heads_up", "strain_now": 61,
         "forecast_peak": 68, "trend": [1, 2], "region": "63101", "last_contacted": None}]})
    monkeypatch.setattr(repo, "cohort_load", lambda: {"staffing_hint": "h", "days": []})
    monkeypatch.setattr(repo, "cohort_detail", lambda pid: {"person_id": pid, "name": "A B.",
        "status": "heads_up", "region": "63101", "strain_now": 61, "baseline": 42, "series": [],
        "drivers": [], "manager_brief": "b", "brief_disclaimer": "x", "programs": [],
        "contact_history": []})
    monkeypatch.setattr(repo, "methods", lambda: {"n_participants": 71, "backtest": []})
    monkeypatch.setattr(repo, "outreach_draft", lambda pid: "draft text")
    # Point the SQLite store at a temp file so feedback/contacted tests don't touch real state.
    monkeypatch.setattr("server.config.DB_PATH", tmp_path / "t.db")
    monkeypatch.setattr("server.store.DB_PATH", tmp_path / "t.db")
    store.init_db()


def test_health():
    assert client.get("/health").json() == {"ok": True}


def test_today_shape():
    d = client.get("/api/caregivers/p_demo/today").json()
    assert d["status"] in ("steady", "building", "heads_up")
    assert {"person_id", "name", "as_of", "series", "drivers", "baseline"} <= d.keys()


def test_headsup_shape():
    d = client.get("/api/caregivers/p_demo/headsup").json()
    assert "988" in d["crisis_note"]
    assert d["note_disclaimer"] == "AI-written, not medical advice."


def test_metrics_shape():
    d = client.get("/api/caregivers/p_demo/metrics").json()
    assert d["metrics"][0]["key"] == "resting_hr"
    m = d["metrics"][0]
    assert {"latest", "baseline", "direction", "low_data", "series", "unit"} <= m.keys()
    assert m["direction"] in ("worse", "better", "steady")


def test_feedback_persists():
    r = client.post("/api/caregivers/p_demo/feedback", json={"program_id": "fca", "helpful": True})
    assert r.json() == {"ok": True}


def test_cohort_summary_shape():
    d = client.get("/api/cohort/summary").json()
    assert d["enrolled"] == d["steady"] + d["building"] + d["heads_up"]
    assert {"enrolled", "steady", "building", "heads_up", "contacted_this_week"} <= d.keys()


def test_cohort_caregivers_list():
    d = client.get("/api/cohort/caregivers?status=heads_up").json()
    assert isinstance(d["caregivers"], list) and d["caregivers"][0]["person_id"] == "p1"


def test_cohort_detail_shape():
    d = client.get("/api/cohort/caregivers/p1").json()
    assert {"manager_brief", "programs", "contact_history", "series"} <= d.keys()


def test_contacted_and_draft():
    assert client.post("/api/cohort/caregivers/p1/contacted").json() == {"ok": True}
    assert client.post("/api/cohort/caregivers/p1/outreach-draft").json() == {"draft": "draft text"}


def test_methods():
    assert client.get("/api/methods").json()["n_participants"] == 71
