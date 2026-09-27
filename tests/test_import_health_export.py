"""Offline tests for the Apple Health export parser (src/import_health_export). Feeds a tiny synthetic
export.xml through the streaming parser and checks the per-day aggregation — no Snowflake, no real file.
"""
import io
from datetime import date

from src import import_health_export as ih

# A minimal export.xml: two days of records across the metrics we care about.
_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_US">
  <Me HKCharacteristicTypeIdentifierBiologicalSex="Male"/>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-08-01 09:00:00 -0500" endDate="2026-08-01 09:10:00 -0500" value="1200"/>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-08-01 18:00:00 -0500" endDate="2026-08-01 18:10:00 -0500" value="800"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" startDate="2026-08-01 07:00:00 -0500" endDate="2026-08-01 07:00:00 -0500" value="58"/>
  <Record type="HKQuantityTypeIdentifierRestingHeartRate" startDate="2026-08-01 22:00:00 -0500" endDate="2026-08-01 22:00:00 -0500" value="62"/>
  <Record type="HKQuantityTypeIdentifierHeartRateVariabilitySDNN" startDate="2026-08-01 03:00:00 -0500" endDate="2026-08-01 03:00:00 -0500" value="45"/>
  <Record type="HKQuantityTypeIdentifierActiveEnergyBurned" startDate="2026-08-01 12:00:00 -0500" endDate="2026-08-01 12:05:00 -0500" value="300"/>
  <Record type="HKQuantityTypeIdentifierBasalEnergyBurned" startDate="2026-08-01 12:00:00 -0500" endDate="2026-08-01 12:05:00 -0500" value="1500"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-08-01 01:00:00 -0500" endDate="2026-08-01 02:00:00 -0500" value="HKCategoryValueSleepAnalysisAsleepCore"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-08-01 02:00:00 -0500" endDate="2026-08-01 03:00:00 -0500" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-08-01 03:00:00 -0500" endDate="2026-08-01 03:30:00 -0500" value="HKCategoryValueSleepAnalysisAwake"/>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-08-02 09:00:00 -0500" endDate="2026-08-02 09:10:00 -0500" value="5000"/>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-08-02 10:00:00 -0500" endDate="2026-08-02 10:10:00 -0500" value="bad_value"/>
</HealthData>"""


def _rows():
    days = ih.parse_export(io.BytesIO(_XML))
    return {r["date"]: r for r in ih.to_rows(days, "p_test", "apple_watch")}


def test_sums_and_averages_per_day():
    r = _rows()["2026-08-01"]
    assert r["steps"] == 2000                 # 1200 + 800, summed
    assert r["resting_hr"] == 60.0            # (58 + 62) / 2, averaged
    assert r["hrv_ms"] == 45.0
    assert r["active_energy_kcal"] == 300.0
    assert r["calories"] == 1800.0            # active 300 + basal 1500


def test_sleep_only_counts_asleep_stages():
    r = _rows()["2026-08-01"]
    assert r["sleep_minutes"] == 120.0        # 60 (Core) + 60 (Deep); Awake excluded


def test_malformed_value_is_skipped_not_fatal():
    r = _rows()["2026-08-02"]
    assert r["steps"] == 5000                 # the "bad_value" step record is dropped, not crashed
    assert r["resting_hr"] is None            # no HR that day


def test_days_filter_keeps_only_recent():
    days = ih.parse_export(io.BytesIO(_XML))
    rows = ih.to_rows(days, "p_test", "apple_watch", since=date(2026, 8, 2))
    assert [r["date"] for r in rows] == ["2026-08-02"]
