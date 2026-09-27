"""Offline tests for the live-scoring pipeline (src/score_live). These cover the pure-Python
transforms — RAW_DAILY column mapping, feature/strain build, and the forecast-derived risk — with
synthetic data, so they run without Snowflake (matching the rest of the offline test suite).
"""
import numpy as np
import pandas as pd

from src.load_index import build
from src import score_live as sl


def _synthetic_raw(person_id="p_live", n=45, seed=1) -> pd.DataFrame:
    """A RAW_DAILY-shaped frame (Snowflake column names) for one Apple Watch participant."""
    rng = np.random.default_rng(seed)
    return pd.DataFrame({
        "person_id": [person_id] * n,
        "date": pd.date_range("2024-02-01", periods=n, freq="D"),
        "steps": rng.normal(7000, 1500, n),
        "resting_hr": rng.normal(60, 4, n),
        "hrv_ms": rng.normal(45, 8, n),          # -> rmssd
        "sleep_minutes": rng.normal(420, 40, n),  # -> minutesAsleep
        "sleep_efficiency": rng.normal(92, 3, n),
        "active_energy_kcal": rng.normal(500, 90, n),
        "calories": rng.normal(2200, 200, n),
        "source": ["apple_watch"] * n,
    })


def test_daily_from_raw_maps_watch_columns():
    daily = sl.daily_from_raw(raw=_synthetic_raw())
    # RAW_DAILY names are renamed to the ones the feature pipeline expects.
    assert {"resting_hr", "rmssd", "minutesAsleep", "sleep_efficiency", "steps"} <= set(daily.columns)
    # hrv_ms became rmssd, sleep_minutes became minutesAsleep — and carry real values.
    assert daily["rmssd"].notna().all()
    assert daily["minutesAsleep"].notna().all()
    assert daily["strain"].isna().all()  # live data has no mood labels


def test_empty_raw_is_handled():
    daily = sl.daily_from_raw(raw=pd.DataFrame(columns=["person_id", "date"]))
    assert daily.empty


def test_strain_and_feature_rows_build_from_live_data():
    daily = sl.daily_from_raw(raw=_synthetic_raw(n=45))
    indexed = build(daily=daily)
    strain = sl.strain_rows(indexed)
    assert not strain.empty
    assert {"person_id", "date", "strain_score"} <= set(strain.columns)
    assert strain["strain_score"].between(0, 100).all()

    feats = sl.feature_rows(indexed, {"p_live"})
    # the columns the metrics panel + drivers read must be present
    for c in ["resting_hr_z", "resting_hr_roll7", "minutesAsleep_z", "rmssd_z",
              "sleep_efficiency_z", "steps_z"]:
        assert c in feats.columns, c


def test_short_history_is_skipped():
    # fewer than MIN_DAYS usable days => no stable baseline => no strain rows (person skipped, not crashed)
    daily = sl.daily_from_raw(raw=_synthetic_raw(n=10))
    strain = sl.strain_rows(build(daily=daily))
    assert strain.empty


def test_person_risk_is_bounded_and_rises_with_forecast():
    strain = pd.DataFrame({
        "person_id": ["p_live"] * 30,
        "date": pd.date_range("2024-02-01", periods=30, freq="D"),
        "strain_score": np.linspace(40, 60, 30),  # p90 ~ 58
    })
    lo = sl.person_risk(strain, pd.DataFrame({
        "person_id": ["p_live"], "date": [pd.Timestamp("2024-03-02")],
        "forecast": [45.0], "lower_bound": [40.0], "upper_bound": [50.0]}))
    hi = sl.person_risk(strain, pd.DataFrame({
        "person_id": ["p_live"], "date": [pd.Timestamp("2024-03-02")],
        "forecast": [75.0], "lower_bound": [70.0], "upper_bound": [80.0]}))
    assert 0.0 <= lo.iloc[0]["risk"] <= 1.0
    assert 0.0 <= hi.iloc[0]["risk"] <= 1.0
    assert hi.iloc[0]["risk"] > lo.iloc[0]["risk"]  # a hotter forecast => higher risk
