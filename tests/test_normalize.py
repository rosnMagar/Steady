"""Normalization of the raw iPhone-Shortcut payload. Pure functions — no Snowflake needed."""
import json
from pathlib import Path

import pytest

from server.normalize import (
    normalize_daily, sleep_minutes, parse_local_date, NormalizationError,
)

SAMPLE = Path(__file__).resolve().parent.parent / "shortcuts" / "sample_payloads" / "daily_raw_shortcut.json"


def test_real_shortcut_payload_normalizes():
    payload = json.loads(SAMPLE.read_text())
    row = normalize_daily(payload)
    assert row["person_id"] == "p_roshan"
    assert row["date"] == "2026-09-26"          # ISO timestamp -> local calendar date, no UTC shift
    assert row["resting_hr"] == 61.0            # string -> float
    assert row["steps"] == 17030.0
    assert row["source"] == "apple_watch"
    # Core+Deep+REM intervals summed: 17+2+22+22+53+14 = 130 minutes.
    assert row["sleep_minutes"] == 130.0


def test_narrow_nobreak_space_before_ampm_parses():
    # U+202F narrow no-break space before AM/PM is what the Shortcut actually sends.
    intervals = [{"start": "Sep 26, 2026 at 1:00 AM", "end": "Sep 26, 2026 at 1:30 AM",
                  "value": "Core"}]
    assert sleep_minutes(intervals) == 30.0


def test_awake_intervals_excluded():
    intervals = [
        {"start": "Sep 26, 2026 at 1:00 AM", "end": "Sep 26, 2026 at 1:30 AM", "value": "Core"},
        {"start": "Sep 26, 2026 at 1:30 AM", "end": "Sep 26, 2026 at 2:00 AM", "value": "Awake"},
    ]
    assert sleep_minutes(intervals) == 30.0


def test_clean_shapes_pass_through():
    row = normalize_daily({"person_id": "p1", "date": "2026-10-03", "resting_hr": 58,
                           "sleep_minutes": 401, "steps": 7412})
    assert row["resting_hr"] == 58.0
    assert row["sleep_minutes"] == 401.0
    assert row["date"] == "2026-10-03"


def test_missing_person_id_rejected():
    with pytest.raises(NormalizationError):
        normalize_daily({"date": "2026-10-03"})


def test_bad_date_rejected():
    with pytest.raises(NormalizationError):
        normalize_daily({"person_id": "p1", "date": "not-a-date"})


def test_no_sleep_data_is_none():
    row = normalize_daily({"person_id": "p1", "date": "2026-10-03"})
    assert row["sleep_minutes"] is None
    assert row["resting_hr"] is None


def test_parse_local_date_accepts_both_forms():
    assert parse_local_date("2026-09-26").isoformat() == "2026-09-26"
    assert parse_local_date("2026-09-26T13:46:53-05:00").isoformat() == "2026-09-26"
