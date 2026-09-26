"""Leakage-safe feature engineering.

Rules:
- Same-day wearables are allowed (we predict strain_t from that day's signals — not forecasting).
- Trailing windows use only past+current days (no future).
- Personal baselines use an EXPANDING (past-only) mean/std, so a day's z-score never sees the future.
- The strain label is never used as a feature.
"""
import numpy as np
import pandas as pd
from .dataset import WEARABLE_COLS


def _personal_z(s: pd.Series) -> pd.Series:
    """Expanding (past-only) z-score within a person: how far today sits from their own normal so far."""
    mean = s.expanding(min_periods=3).mean().shift(1)
    std = s.expanding(min_periods=3).std().shift(1)
    return (s - mean) / std.replace(0, np.nan)


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add rolling + personal-baseline features per person. Returns df with feature columns."""
    df = df.sort_values(["person_id", "date"]).copy()
    feats = []

    for col in WEARABLE_COLS:
        if col not in df.columns:
            continue
        g = df.groupby("person_id")[col]
        # trailing 7-day mean (min 2 obs), shifted so it's strictly past-inclusive of today
        df[f"{col}_roll7"] = g.transform(lambda s: s.rolling(7, min_periods=2).mean())
        # personal z-score (past-only) — the transferable "deviation from your normal" signal
        df[f"{col}_z"] = g.transform(_personal_z)
        # 3-day slope (today minus 3 days ago)
        df[f"{col}_d3"] = g.transform(lambda s: s - s.shift(3))
        feats += [col, f"{col}_roll7", f"{col}_z", f"{col}_d3"]

    df.attrs["feature_cols"] = feats
    return df


if __name__ == "__main__":
    from .dataset import load_daily
    d = build_features(load_daily())
    fc = d.attrs["feature_cols"]
    print(f"{len(fc)} features built")
    labeled = d.dropna(subset=["strain"])
    print(f"labeled rows: {len(labeled)} | feature non-null coverage on labeled rows:")
    print((labeled[fc].notna().mean() * 100).round(0).sort_values().to_string())
