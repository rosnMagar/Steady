"""No-leakage test: a feature at day t must not depend on any future day.
We build features, then spike the LAST day's raw signals and confirm every earlier feature row is
unchanged. If a rolling/z feature peeked into the future, an earlier row would move.
"""
import numpy as np
import pandas as pd
from src.features import build_features
from src.dataset import WEARABLE_COLS


def _synthetic(n=25, seed=0):
    rng = np.random.default_rng(seed)
    df = pd.DataFrame({
        "person_id": ["p1"] * n,
        "date": pd.date_range("2024-01-01", periods=n, freq="D"),
    })
    for c in WEARABLE_COLS:
        df[c] = rng.normal(50, 8, n)
    return df


def test_future_change_does_not_affect_past_features():
    df = _synthetic()
    a = build_features(df.copy())
    feat_cols = a.attrs["feature_cols"]

    df2 = df.copy()
    df2.loc[df2.index[-1], WEARABLE_COLS] += 1000.0  # huge spike on the LAST day only
    b = build_features(df2)

    past_a = a[feat_cols].iloc[:-1].reset_index(drop=True)
    past_b = b[feat_cols].iloc[:-1].reset_index(drop=True)
    pd.testing.assert_frame_equal(past_a, past_b, check_exact=False,
                                  obj="past features changed when a FUTURE value moved (leakage!)")


def test_personal_z_is_shifted_past_only():
    # first row can have no personal baseline (needs prior history) -> NaN, never a same-day leak
    df = _synthetic()
    out = build_features(df)
    zcol = [c for c in out.attrs["feature_cols"] if c.endswith("_z")][0]
    assert pd.isna(out[zcol].iloc[0])
