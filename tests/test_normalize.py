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


# ── sleep stage naming (regression: full HealthKit identifiers silently yielded no sleep) ──
from server.normalize import classify_sleep_stage, sleep_metrics


def _iv(start, end, value):
    return {"start": f"Sep 27, 2026 at {start} AM", "end": f"Sep 27, 2026 at {end} AM",
            "value": value}


def test_full_healthkit_identifiers_count_as_sleep():
    """The export and HealthKit use 'HKCategoryValueSleepAnalysisAsleepCore'; the Shortcuts picker
    uses 'Core'. Both must work — only the short form did, so sleep silently came through empty."""
    for v in ("Core", "AsleepCore", "HKCategoryValueSleepAnalysisAsleepCore"):
        assert classify_sleep_stage(v) == "asleep", v
        assert sleep_metrics([_iv("1:00", "2:00", v)])["asleep_min"] == 60.0


def test_awake_is_never_counted_as_sleep():
    for v in ("Awake", "HKCategoryValueSleepAnalysisAwake"):
        assert classify_sleep_stage(v) == "awake", v
    assert sleep_metrics([_iv("1:00", "2:00", "Awake")])["asleep_min"] is None


def test_inbed_recognised_and_not_sleep():
    for v in ("InBed", "HKCategoryValueSleepAnalysisInBed"):
        assert classify_sleep_stage(v) == "inbed", v


def test_efficiency_matches_asleep_over_inbed():
    m = sleep_metrics([_iv("1:00", "3:00", "Core"), _iv("3:00", "3:30", "Awake")])
    assert m["asleep_min"] == 120.0 and m["inbed_min"] == 150.0
    assert m["efficiency"] == 80.0


def test_efficiency_is_none_without_a_real_denominator():
    """Asleep stages alone would make in-bed == asleep, i.e. a meaningless flat 100%."""
    assert sleep_metrics([_iv("1:00", "3:00", "Core")])["efficiency"] is None


def test_unrecognised_values_are_reported_not_silent():
    m = sleep_metrics([_iv("1:00", "2:00", "Bogus")])
    assert m["asleep_min"] is None
    assert m["intervals"] == 1 and m["recognized"] == 0
    assert m["unrecognized"] == ["Bogus"]


# ── timestamp shapes: the Shortcut's Format Date action decides these, so accept what it emits ──

@pytest.mark.parametrize("start,end", [
    ("Sep 27, 2026 at 1:00 AM", "Sep 27, 2026 at 2:00 AM"),   # medium date + short time (default)
    ("Sep 27, 2026 at 01:00", "Sep 27, 2026 at 02:00"),       # 24-hour locale
    ("Sep 27, 2026, 1:00 AM", "Sep 27, 2026, 2:00 AM"),       # comma instead of "at"
    ("2026-09-27T01:00:00", "2026-09-27T02:00:00"),           # ISO 8601
    ("2026-09-27T01:00:00-05:00", "2026-09-27T02:00:00-05:00"),
])
def test_interval_timestamp_formats_accepted(start, end):
    assert sleep_metrics([{"start": start, "end": end, "value": "Core"}])["asleep_min"] == 60.0


def test_mixed_aware_and_naive_interval_ends_do_not_crash():
    m = sleep_metrics([{"start": "2026-09-27T01:00:00-05:00", "end": "2026-09-27T02:00:00",
                        "value": "Core"}])
    assert m["asleep_min"] == 60.0


def test_unparseable_timestamp_is_rejected_loudly():
    with pytest.raises(NormalizationError):
        sleep_metrics([{"start": "whenever", "end": "later", "value": "Core"}])
