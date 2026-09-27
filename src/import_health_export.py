"""Bulk-import an Apple Health export into RAW_DAILY (the 30-60 day backfill, without the phone).

Apple Health -> profile pic -> "Export All Health Data" gives export.zip; unzipped its export.xml is
hundreds of MB, so we STREAM it (xml.etree.iterparse, clearing as we go) and read straight from the
.zip member — no full extraction, flat memory. We aggregate the HealthKit records into one daily row
per calendar date (same shape as RAW_DAILY / the ingest payload) and upsert them, idempotently.

    .venv/bin/python -m src.import_health_export ~/apple_health_export.zip --dry-run
    .venv/bin/python -m src.import_health_export ~/apple_health_export.zip            # write to Snowflake
    .venv/bin/python -m src.import_health_export ~/export.xml --person-id p_roshan --days 120

Then run `python -m src.score_live` to turn the freshly loaded history into a forecast.
"""
from __future__ import annotations
import argparse
import zipfile
from collections import defaultdict
from datetime import datetime, date, timedelta
from pathlib import Path

import pandas as pd

from .snowflake_io import connect, load_dataframe

# HealthKit record type  ->  how we accumulate it into a day.
QUANTITY_TYPES = {
    "HKQuantityTypeIdentifierStepCount": "steps",                 # summed
    "HKQuantityTypeIdentifierRestingHeartRate": "resting_hr",     # averaged
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": "hrv_ms", # averaged (ms)
    "HKQuantityTypeIdentifierActiveEnergyBurned": "active_energy_kcal",  # summed
    "HKQuantityTypeIdentifierBasalEnergyBurned": "basal_energy_kcal",    # summed
}
SLEEP_TYPE = "HKCategoryTypeIdentifierSleepAnalysis"
SUMMED = {"steps", "active_energy_kcal", "basal_energy_kcal"}
AVERAGED = {"resting_hr", "hrv_ms"}


def _local_day(ts: str) -> str | None:
    """'2024-01-15 07:23:45 -0600' -> '2024-01-15' (the LOCAL calendar day, no UTC shift)."""
    return ts[:10] if ts and len(ts) >= 10 else None


def _parse_dt(ts: str) -> datetime:
    return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S %z")


class _DayAgg:
    __slots__ = ("sums", "counts", "asleep_min", "inbed_min")

    def __init__(self):
        self.sums: dict[str, float] = defaultdict(float)
        self.counts: dict[str, int] = defaultdict(int)
        self.asleep_min = 0.0
        self.inbed_min = 0.0


def _open_xml(path: Path):
    """Yield a binary stream of export.xml, reading from a .zip member without extracting it."""
    if path.suffix.lower() == ".zip":
        zf = zipfile.ZipFile(path)
        member = next((n for n in zf.namelist()
                       if n.endswith("export.xml") and not n.endswith("export_cda.xml")), None)
        if member is None:
            raise FileNotFoundError("no export.xml inside the zip")
        return zf.open(member)  # stream; caller iterates then it closes with the process
    return open(path, "rb")


def parse_export(stream) -> dict[str, _DayAgg]:
    """Stream the Health export and aggregate every relevant record into per-day accumulators."""
    import xml.etree.ElementTree as ET
    days: dict[str, _DayAgg] = defaultdict(_DayAgg)
    it = ET.iterparse(stream, events=("end",))
    for _, elem in it:
        if elem.tag != "Record":
            elem.clear()
            continue
        rtype = elem.get("type")
        try:
            if rtype in QUANTITY_TYPES:
                day = _local_day(elem.get("startDate"))
                val = float(elem.get("value"))
                if day:
                    key = QUANTITY_TYPES[rtype]
                    days[day].sums[key] += val
                    days[day].counts[key] += 1
            elif rtype == SLEEP_TYPE:
                start, end = elem.get("startDate"), elem.get("endDate")
                day = _local_day(start)
                if day and start and end:
                    mins = (_parse_dt(end) - _parse_dt(start)).total_seconds() / 60.0
                    if mins > 0:
                        value = (elem.get("value") or "")
                        if "InBed" in value:
                            days[day].inbed_min += mins
                        elif "Asleep" in value:  # AsleepCore / Deep / REM / Unspecified
                            days[day].asleep_min += mins
                            days[day].inbed_min += mins  # asleep also counts as in-bed time
        except (TypeError, ValueError):
            pass  # skip a malformed record rather than abort the whole import
        elem.clear()
    return days


def to_rows(days: dict[str, _DayAgg], person_id: str, source: str,
            since: date | None = None) -> list[dict]:
    """Finalize per-day accumulators into RAW_DAILY-shaped rows (averages averaged, sums summed)."""
    rows = []
    for day in sorted(days):
        if since and date.fromisoformat(day) < since:
            continue
        a = days[day]

        def avg(k):
            return round(a.sums[k] / a.counts[k], 1) if a.counts[k] else None

        def total(k):
            return round(a.sums[k], 1) if a.counts[k] else None

        active = total("active_energy_kcal")
        basal = total("basal_energy_kcal")
        calories = round((active or 0) + (basal or 0), 1) if (active or basal) else None
        sleep_min = round(a.asleep_min, 1) if a.asleep_min else None
        sleep_eff = (round(min(a.asleep_min / a.inbed_min * 100, 100), 1)
                     if a.inbed_min > 0 and a.asleep_min else None)
        rows.append({
            "person_id": person_id,
            "date": day,
            "steps": total("steps"),
            "resting_hr": avg("resting_hr"),
            "hrv_ms": avg("hrv_ms"),
            "sleep_minutes": sleep_min,
            "sleep_efficiency": sleep_eff,
            "active_energy_kcal": active,
            "calories": calories,
            "source": source,
        })
    return rows


RAW_COLS = ["person_id", "date", "steps", "resting_hr", "hrv_ms", "sleep_minutes",
            "sleep_efficiency", "active_energy_kcal", "calories", "source"]


def upload(rows: list[dict], person_id: str, source: str) -> int:
    """Idempotent bulk load: replace this person's rows for `source`, then insert the parsed history."""
    if not rows:
        return 0
    df = pd.DataFrame(rows)[RAW_COLS].copy()
    df["date"] = pd.to_datetime(df["date"]).dt.date  # Snowflake DATE
    with connect() as c:
        c.cursor().execute(
            f"DELETE FROM RAW_DAILY WHERE person_id='{person_id}' AND source='{source}'")
    return load_dataframe(df, "RAW_DAILY")


def _summary(rows: list[dict]) -> str:
    if not rows:
        return "(no rows)"
    df = pd.DataFrame(rows)
    cov = {c: f"{df[c].notna().mean() * 100:.0f}%" for c in
           ["steps", "resting_hr", "hrv_ms", "sleep_minutes", "sleep_efficiency", "calories"]}
    return (f"{len(rows)} days: {rows[0]['date']} -> {rows[-1]['date']}\n"
            f"coverage: " + ", ".join(f"{k} {v}" for k, v in cov.items()))


def main(argv=None):
    ap = argparse.ArgumentParser(description="Import Apple Health export into RAW_DAILY.")
    ap.add_argument("path", help="apple_health_export.zip or export.xml")
    ap.add_argument("--person-id", default="p_roshan")
    ap.add_argument("--source", default="apple_watch")
    ap.add_argument("--days", type=int, default=120, help="keep only the last N days (0 = all)")
    ap.add_argument("--dry-run", action="store_true", help="parse + summarize, write nothing")
    args = ap.parse_args(argv)

    path = Path(args.path).expanduser()
    since = (date.today() - timedelta(days=args.days)) if args.days else None
    print(f"parsing {path} …")
    stream = _open_xml(path)
    days = parse_export(stream)
    rows = to_rows(days, args.person_id, args.source, since=since)
    print(_summary(rows))

    if args.dry_run:
        print("[dry-run] nothing written.")
        return
    n = upload(rows, args.person_id, args.source)
    print(f"loaded {n} rows into RAW_DAILY for {args.person_id!r} (source={args.source!r}).")
    print("next: .venv/bin/python -m src.score_live")


if __name__ == "__main__":
    main()
