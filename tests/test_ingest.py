"""Ingest route behavior: auth (200/401), idempotency, validation. No Snowflake — the DB writers
are monkeypatched, so these run offline."""
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from server.main import app
from server import repo

client = TestClient(app)  # no context manager -> startup events don't fire (no Snowflake at import)

# Relative, not hard-coded: a literal date drifts into the future as time passes, and the
# ingest routes now reject future dates.
YESTERDAY = (date.today() - timedelta(days=1)).isoformat()
NEXT_WEEK = (date.today() + timedelta(days=7)).isoformat()

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
    """Capture upserts and background triggers instead of writing to Snowflake, and force a known
    token. TestClient runs BackgroundTasks synchronously after the response, so the trigger must
    be stubbed here — otherwise the real src.score_live would try to open a Snowflake connection
    during offline tests."""
    calls = {"daily": [], "rescored": []}
    monkeypatch.setattr(repo, "upsert_daily", lambda rows: calls["daily"].append(rows) or len(rows))
    monkeypatch.setattr(repo, "upsert_checkin", lambda *a, **k: None)
    monkeypatch.setattr("server.auth.INGEST_TOKEN", TOKEN)
    monkeypatch.setattr("server.routes_ingest._trigger_live_rescore",
                        lambda pid: calls["rescored"].append(pid))
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
    body = r.json()
    assert (body["ok"], body["person_id"], body["date"]) == (True, "p_test", "2026-09-26")
    # The response reports what the sleep parser made of the payload, so a null sleep value on the
    # phone is diagnosable instead of silent.
    assert body["sleep"]["minutes"] == 30.0
    assert body["sleep"]["intervals_received"] == body["sleep"]["intervals_used"] == 1
    assert body["sleep"]["unrecognized_values"] == []
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
    many = {"days": [dict(DAILY, date=f"2026-08-{d:02d}") for d in range(1, 30)] * 3}  # 87 > 60
    r = client.post("/ingest/backfill", json=many, headers=AUTH)
    assert r.status_code == 422


def test_backfill_ok():
    body = {"days": [dict(DAILY, date="2026-09-25"), dict(DAILY, date="2026-09-26")]}
    r = client.post("/ingest/backfill", json=body, headers=AUTH)
    assert r.status_code == 200
    assert r.json() == {"ok": True, "count": 2}


# ── background live-rescore scheduling ───────────────────────────────────────
def test_daily_schedules_live_rescore(_capture_writes):
    """An apple_watch daily POST should return fast AND schedule a rescore. The rescore is what
    promotes the new RAW_DAILY row into FEATURES/STRAIN_SCORE/RISK/ALERTS — without it, the
    dashboard would keep showing yesterday's data until the nightly Snowflake Task."""
    r = client.post("/ingest/daily", json=DAILY, headers=AUTH)
    assert r.status_code == 200
    assert _capture_writes["rescored"] == ["p_test"]


def test_daily_does_not_schedule_rescore_for_non_watch_source(_capture_writes):
    """LifeSnaps and any non-apple_watch source is pre-scored; per-ingest rescoring would waste
    warehouse credits retraining an ML.FORECAST that nothing consumes."""
    lifesnaps = dict(DAILY, source="lifesnaps")
    r = client.post("/ingest/daily", json=lifesnaps, headers=AUTH)
    assert r.status_code == 200
    assert _capture_writes["rescored"] == []


def test_backfill_schedules_one_rescore_per_person(_capture_writes):
    """A 30-day backfill for one person should trigger ONE rescore (score_live rebuilds the whole
    series each call), not 30. Two people in the same backfill should trigger two."""
    body = {"days": [
        dict(DAILY, date="2026-09-24"),
        dict(DAILY, date="2026-09-25"),
        dict(DAILY, date="2026-09-26"),
        dict(DAILY, person_id="p_other", date="2026-09-26"),
    ]}
    r = client.post("/ingest/backfill", json=body, headers=AUTH)
    assert r.status_code == 200
    assert sorted(_capture_writes["rescored"]) == ["p_other", "p_test"]


def test_checkin_validation_stress_range():
    bad = {"person_id": "p_test", "date": YESTERDAY, "stress": 9}
    assert client.post("/ingest/checkin", json=bad, headers=AUTH).status_code == 422


def test_checkin_ok():
    good = {"person_id": "p_test", "date": YESTERDAY, "stress": 4, "tags": ["poor_sleep"]}
    r = client.post("/ingest/checkin", json=good, headers=AUTH)
    assert r.status_code == 200 and r.json() == {"ok": True, "date": YESTERDAY}


def test_checkin_rejects_future_date():
    """A check-in for a day that hasn't happened joins to no wearable row; it used to land
    silently because the route passed the date string straight to Snowflake."""
    ahead = {"person_id": "p_test", "date": NEXT_WEEK, "stress": 4}
    r = client.post("/ingest/checkin", json=ahead, headers=AUTH)
    assert r.status_code == 422 and "future" in r.json()["detail"]


def test_checkin_normalizes_timestamp_to_local_day():
    ts = {"person_id": "p_test", "date": "2026-09-26T13:46:53-05:00", "stress": 3}
    r = client.post("/ingest/checkin", json=ts, headers=AUTH)
    assert r.status_code == 200 and r.json()["date"] == "2026-09-26"
