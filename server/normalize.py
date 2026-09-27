"""Normalize the raw iPhone-Shortcut payload into a clean RAW_DAILY row.

The Shortcut sends messy input (confirmed on-device 2026-09-26,
shortcuts/sample_payloads/daily_raw_shortcut.json). We clean it here so ingest accepts what the
phone actually sends and RAW_DAILY stays tidy. Pure functions — no I/O, fully unit-tested.
"""
from __future__ import annotations
import re
from datetime import datetime, date

# Sleep-stage values that count as time asleep, as the Shortcut's picker spells them.
_ASLEEP_SHORT = {"core", "rem", "deep", "asleep", "unspecified"}
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


def classify_sleep_stage(value) -> str | None:
    """Map a sleep-stage label to 'asleep' | 'awake' | 'inbed', or None if unrecognised.

    Tolerates every spelling these values arrive in, because the source decides the form and we
    got burned by assuming one: the Shortcuts picker yields short names ("Core", "REM"), while
    HealthKit and the Health export use the full identifier
    ("HKCategoryValueSleepAnalysisAsleepCore"). Order matters — test 'awake'/'inbed' before
    'asleep', since "Awake" must never be counted as sleep.
    """
    v = _clean_spaces(str(value or "")).lower().replace(" ", "")
    if not v:
        return None
    v = v.removeprefix("hkcategoryvaluesleepanalysis")
    if "awake" in v:
        return "awake"
    if "inbed" in v:
        return "inbed"
    if "asleep" in v or v in _ASLEEP_SHORT:
        return "asleep"
    return None


def sleep_metrics(sleep_raw) -> dict:
    """Derive sleep duration and efficiency from raw stage intervals.

    Returns asleep/in-bed minutes, efficiency, and counts of what was recognised — the counts are
    what make a null answer diagnosable instead of silent.

    Efficiency uses the same formula as the export backfill (src/import_health_export.py): asleep
    time also counts as in-bed time, and the result is capped at 100. It is only reported when a
    real denominator exists (an Awake or InBed interval was actually sent) — if the Shortcut sends
    asleep stages alone, in-bed equals asleep and efficiency would be a meaningless flat 100%.
    """
    out = {"asleep_min": None, "inbed_min": None, "efficiency": None,
           "intervals": 0, "recognized": 0, "unrecognized": []}
    if not sleep_raw:
        return out
    if not isinstance(sleep_raw, list):
        raise NormalizationError("sleep_raw must be a list of {start,end,value}")

    asleep = inbed = 0.0
    counted = 0
    has_denominator = False
    unknown: list[str] = []
    for iv in sleep_raw:
        out["intervals"] += 1
        stage = classify_sleep_stage(iv.get("value"))
        if stage is None:
            label = str(iv.get("value", ""))[:40]
            if label not in unknown:
                unknown.append(label)
            continue
        try:
            start, end = _parse_ts(iv["start"]), _parse_ts(iv["end"])
        except (KeyError, ValueError) as e:
            raise NormalizationError(f"bad sleep interval {iv!r}: {e}")
        mins = (end - start).total_seconds() / 60.0
        if mins <= 0:
            continue
        counted += 1
        if stage == "asleep":
            asleep += mins
            inbed += mins          # asleep time is also in-bed time
        else:                      # awake / inbed both extend the in-bed window
            inbed += mins
            has_denominator = True

    out["recognized"] = counted
    out["unrecognized"] = unknown
    if not counted:
        return out
    out["asleep_min"] = round(asleep, 1) if asleep else None
    out["inbed_min"] = round(inbed, 1) if inbed else None
    if asleep and inbed > 0 and has_denominator:
        out["efficiency"] = round(min(asleep / inbed * 100, 100), 1)
    return out


def sleep_minutes(sleep_raw) -> float | None:
    """Minutes asleep from raw stage intervals. None when no usable interval data is present."""
    return sleep_metrics(sleep_raw)["asleep_min"]


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

    # sleep: accept clean 'sleep_minutes' or derive from raw stage intervals. Efficiency is
    # derived the same way, so the live path matches the export backfill instead of staying null.
    metrics = sleep_metrics(payload.get("sleep_raw"))
    if payload.get("sleep_minutes") is not None:
        sleep_min = _to_float(payload.get("sleep_minutes"), "sleep_minutes")
    else:
        sleep_min = metrics["asleep_min"]
    sleep_eff = payload.get("sleep_efficiency")
    sleep_eff = _to_float(sleep_eff, "sleep_efficiency") if sleep_eff is not None else metrics["efficiency"]

    return {
        "person_id": person_id,
        "date": d.isoformat(),
        "steps": _to_float(payload.get("steps"), "steps"),
        "resting_hr": resting_hr,
        "hrv_ms": _to_float(payload.get("hrv_ms"), "hrv_ms"),
        "sleep_minutes": sleep_min,
        "sleep_efficiency": sleep_eff,
        "active_energy_kcal": _to_float(payload.get("active_energy_kcal"), "active_energy_kcal"),
        "calories": _to_float(payload.get("calories"), "calories"),
        "source": str(payload.get("source") or "apple_watch"),
    }
