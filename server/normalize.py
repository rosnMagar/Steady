"""Normalize the raw iPhone-Shortcut payload into a clean RAW_DAILY row.

The Shortcut sends messy input (confirmed on-device 2026-09-26,
shortcuts/sample_payloads/daily_raw_shortcut.json). We clean it here so ingest accepts what the
phone actually sends and RAW_DAILY stays tidy. Pure functions — no I/O, fully unit-tested.
"""
from __future__ import annotations
import re
from datetime import datetime, date

# Sleep-stage values that count as time asleep (Awake is excluded).
_ASLEEP = {"core", "rem", "deep", "asleep"}
# The Shortcut formats times as "Sep 26, 2026 at 1:16 AM" with a NARROW NO-BREAK SPACE (U+202F)
# before AM/PM, and sometimes a regular/again-narrow space elsewhere. Normalize all unicode spaces.
_UNICODE_SPACES = dict.fromkeys(map(ord, "    ⁠"), " ")


class NormalizationError(ValueError):
    """Raised when a payload can't be turned into a valid daily row."""


def _clean_spaces(s: str) -> str:
    return re.sub(r"\s+", " ", s.translate(_UNICODE_SPACES)).strip()


def _to_float(v, field: str):
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        raise NormalizationError(f"{field!r} is not a number: {v!r}")


def parse_local_date(value: str) -> date:
    """Accept a date-only 'YYYY-MM-DD' or a full ISO timestamp; keep the local calendar date.

    A timestamp like '2026-09-26T13:46:53-05:00' stores as 2026-09-26 (the phone's local day),
    NOT shifted to UTC — the day is what the caregiver experienced.
    """
    if not isinstance(value, str) or not value.strip():
        raise NormalizationError("date is required")
    s = value.strip()
    try:
        # date() of a tz-aware datetime keeps the local wall-clock day (no UTC shift).
        return datetime.fromisoformat(s).date()
    except ValueError:
        pass
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        raise NormalizationError(f"unparseable date: {value!r}")


def _parse_ts(s: str) -> datetime:
    return datetime.strptime(_clean_spaces(s), "%b %d, %Y at %I:%M %p")


def sleep_minutes(sleep_raw) -> float | None:
    """Sum minutes of asleep-stage intervals. Returns None if no interval data is present."""
    if not sleep_raw:
        return None
    if not isinstance(sleep_raw, list):
        raise NormalizationError("sleep_raw must be a list of {start,end,value}")
    total = 0.0
    counted = 0
    for iv in sleep_raw:
        if str(iv.get("value", "")).strip().lower() not in _ASLEEP:
            continue
        try:
            start, end = _parse_ts(iv["start"]), _parse_ts(iv["end"])
        except (KeyError, ValueError) as e:
            raise NormalizationError(f"bad sleep interval {iv!r}: {e}")
        mins = (end - start).total_seconds() / 60.0
        if mins > 0:
            total += mins
            counted += 1
    return round(total, 1) if counted else None


def normalize_daily(payload: dict) -> dict:
    """Raw Shortcut payload -> a dict keyed exactly like RAW_DAILY columns (minus loaded_at).

    Provided sleep_minutes/resting_hr (already-clean shapes, e.g. the LifeSnaps loader or a retry)
    are honored; raw shapes (sleep_raw, resting_heart_rate string) are converted.
    """
    if not isinstance(payload, dict):
        raise NormalizationError("payload must be an object")
    person_id = payload.get("person_id")
    if not person_id or not isinstance(person_id, str):
        raise NormalizationError("person_id is required")

    d = parse_local_date(payload.get("date"))

    # resting_hr: accept clean 'resting_hr' or the Shortcut's string 'resting_heart_rate'.
    resting_hr = _to_float(payload.get("resting_hr", payload.get("resting_heart_rate")), "resting_hr")

    # sleep: accept clean 'sleep_minutes' or derive from raw stage intervals.
    if payload.get("sleep_minutes") is not None:
        sleep_min = _to_float(payload.get("sleep_minutes"), "sleep_minutes")
    else:
        sleep_min = sleep_minutes(payload.get("sleep_raw"))

    return {
        "person_id": person_id,
        "date": d.isoformat(),
        "steps": _to_float(payload.get("steps"), "steps"),
        "resting_hr": resting_hr,
        "hrv_ms": _to_float(payload.get("hrv_ms"), "hrv_ms"),
        "sleep_minutes": sleep_min,
        "sleep_efficiency": _to_float(payload.get("sleep_efficiency"), "sleep_efficiency"),
        "active_energy_kcal": _to_float(payload.get("active_energy_kcal"), "active_energy_kcal"),
        "calories": _to_float(payload.get("calories"), "calories"),
        "source": str(payload.get("source") or "apple_watch"),
    }
