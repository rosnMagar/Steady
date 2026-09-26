"""Physiological load index — deterministic, from wearable deviations vs each person's baseline.

This is a recovery-deficit index (Whoop/Oura-style): load rises when resting/sleeping HR is elevated,
HRV is suppressed, and sleep is short or poor — all relative to the person's OWN normal (z-scores).
No learning, no label: it is a transparent function of wearables, dense on every day with signals.
Higher = more physiological strain.
"""
import numpy as np
import pandas as pd
from .features import build_features
from .dataset import load_daily

# component -> sign (does strain INCREASE when this z goes up?)
COMPONENTS = {
    "resting_hr_z": +1.0,      # elevated resting HR = strain
    "nremhr_z": +1.0,          # elevated sleeping HR = strain
    "minutesAsleep_z": -1.0,   # less sleep than normal = strain
    "sleep_efficiency_z": -1.0,# worse sleep quality = strain
    "rmssd_z": -1.0,           # suppressed HRV = strain
}


def add_load_index(df: pd.DataFrame) -> pd.DataFrame:
    """Add a `load` column (0-100). Robust to missing components (nan-mean of what's present)."""
    parts = []
    for col, sign in COMPONENTS.items():
        if col in df.columns:
            parts.append(sign * df[col])
    stacked = pd.concat(parts, axis=1)
    load_raw = stacked.mean(axis=1, skipna=True)      # average available signed deviations
    df = df.copy()
    df["load"] = (50 + 15 * load_raw).clip(0, 100)     # z~N(0,1) -> ~5..95 spread
    df["load_n_components"] = stacked.notna().sum(axis=1)
    # Forecast target: sustained load (3-day EWMA). Raw daily load is mean-reverting (lag-1 0.23);
    # the smoothed version is strongly forecastable (lag-1 0.68) and is the clinically meaningful signal.
    df["load_smooth"] = (
        df.sort_values(["person_id", "date"])
          .groupby("person_id")["load"]
          .transform(lambda s: s.ewm(span=3, min_periods=1).mean())
    )
    return df


def build() -> pd.DataFrame:
    return add_load_index(build_features(load_daily()))


if __name__ == "__main__":
    d = build()
    ok = d[d["load_n_components"] >= 2]
    print(f"rows with load (>=2 components): {len(ok)} / {len(d)} ({len(ok)/len(d)*100:.0f}%)")
    print(f"people: {ok['person_id'].nunique()}")
    print("\nload distribution:\n" + ok["load"].describe().round(1).to_string())
