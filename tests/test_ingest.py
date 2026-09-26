"""Ingest route behavior: auth (200/401), idempotency, validation. No Snowflake — the DB writers
are monkeypatched, so these run offline."""
import pytest
from fastapi.testclient import TestClient

from server.main import app
from server import repo

client = TestClient(app)  # no context manager -> startup events don't fire (no Snowflake at import)

TOKEN = "test-token"  # clean secret; the fixture forces auth to use it
AUTH = {"Authorization": f"Bearer {TOKEN}"}

DAILY = {
    "person_id": "p_test", "date": "2026-09-26T13:46:53-05:00", "steps": 17030,
    "resting_heart_rate": "61",
    "sleep_raw": [{"start": "Sep 26, 2026 at 1:00 AM", "end": "Sep 26, 2026 at 1:30 AM",
                   "value": "Core"}],
    "source": "apple_watch",
}


@pytest.fixture(autouse=True)
def _capture_writes(monkeypatch):
    """Capture upserts instead of writing to Snowflake, and force a known token."""
    calls = {"daily": []}
    monkeypatch.setattr(repo, "upsert_daily", lambda rows: calls["daily"].append(rows) or len(rows))
    monkeypatch.setattr(repo, "upsert_checkin", lambda *a, **k: None)
    monkeypatch.setattr("server.auth.INGEST_TOKEN", TOKEN)
    return calls


def test_daily_requires_token():
    r = client.post("/ingest/daily", json=DAILY)
    assert r.status_code == 401


def test_daily_rejects_wrong_token():
    r = client.post("/ingest/daily", json=DAILY, headers={"Authorization": "Bearer nope"})
    assert r.status_code == 401


def test_daily_accepts_valid_token_and_normalizes(_capture_writes):
    r = client.post("/ingest/daily", json=DAILY, headers=AUTH)
    assert r.status_code == 200
    assert r.json() == {"ok": True, "person_id": "p_test", "date": "2026-09-26"}
    row = _capture_writes["daily"][0][0]
    assert row["resting_hr"] == 61.0 and row["sleep_minutes"] == 30.0


def test_daily_idempotent_same_key(_capture_writes):
    # Two identical posts -> same normalized (person_id, date); the upsert key is stable.
    for _ in range(2):
        assert client.post("/ingest/daily", json=DAILY, headers=AUTH).status_code == 200
    keys = {(rows[0]["person_id"], rows[0]["date"]) for rows in _capture_writes["daily"]}
    assert keys == {("p_test", "2026-09-26")}


def test_daily_validation_missing_fields():
    r = client.post("/ingest/daily", json={"steps": 5}, headers=AUTH)  # no person_id/date
    assert r.status_code == 422


def test_backfill_caps_at_60():
    many = {"days": [dict(DAILY, date=f"2026-09-{d:02d}") for d in range(1, 30)] * 3}  # 87 > 60
    r = client.post("/ingest/backfill", json=many, headers=AUTH)
    assert r.status_code == 422


def test_backfill_ok():
    body = {"days": [dict(DAILY, date="2026-09-25"), dict(DAILY, date="2026-09-26")]}
    r = client.post("/ingest/backfill", json=body, headers=AUTH)
    assert r.status_code == 200
    assert r.json() == {"ok": True, "count": 2}


def test_checkin_validation_stress_range():
    bad = {"person_id": "p_test", "date": "2026-10-03", "stress": 9}
    assert client.post("/ingest/checkin", json=bad, headers=AUTH).status_code == 422


def test_checkin_ok():
    good = {"person_id": "p_test", "date": "2026-10-03", "stress": 4, "tags": ["poor_sleep"]}
    r = client.post("/ingest/checkin", json=good, headers=AUTH)
    assert r.status_code == 200 and r.json() == {"ok": True}
