"""Stage-1: predict strain from wearables. Person-aware CV vs the baselines that actually matter.

The bar to clear is the PERSONAL-MEAN baseline: predicting each person's own average strain.
Beating it means we capture within-person day-to-day variation from wearables — the real claim.
GroupKFold holds out whole people, so we measure transfer to unseen individuals.
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_absolute_error
from lightgbm import LGBMRegressor

from .dataset import load_daily, MOOD_COLS
from .features import build_features


def run(n_splits: int = 5, min_labeled: int = 20):
    df = build_features(load_daily())
    feature_cols = df.attrs["feature_cols"]

    # keep only labeled rows from people with enough history
    lab = df.dropna(subset=["strain"]).copy()
    counts = lab["person_id"].value_counts()
    keep = counts[counts >= min_labeled].index
    lab = lab[lab["person_id"].isin(keep)].reset_index(drop=True)
    X = lab[feature_cols]
    y = lab["strain"].values
    groups = lab["person_id"].values
    print(f"{len(lab)} labeled rows, {lab['person_id'].nunique()} people (>= {min_labeled} days), {len(feature_cols)} features")

    gkf = GroupKFold(n_splits=n_splits)
    mae_model, mae_pmean, mae_gmean, mae_last = [], [], [], []

    for tr, te in gkf.split(X, y, groups):
        model = LGBMRegressor(n_estimators=300, learning_rate=0.03, num_leaves=15,
                              min_child_samples=20, subsample=0.8, colsample_bytree=0.8,
                              verbose=-1)
        model.fit(X.iloc[tr], y[tr])
        pred = model.predict(X.iloc[te])
        mae_model.append(mean_absolute_error(y[te], pred))

        # baselines
        gmean = y[tr].mean()
        mae_gmean.append(mean_absolute_error(y[te], np.full(len(te), gmean)))
        # personal mean: each test person's own mean strain (computed on their TRAIN-fold rows if any,
        # else fall back to their test-set mean — a generous baseline, hardest to beat)
        te_df = lab.iloc[te]
        pmean_pred = te_df.groupby("person_id")["strain"].transform("mean").values
        mae_pmean.append(mean_absolute_error(y[te], pmean_pred))
        # last-observed strain (forecasting-flavored, past-only within person)
        last = te_df.sort_values(["person_id", "date"]).groupby("person_id")["strain"].shift(1)
        last = last.fillna(te_df["strain"].mean())
        mae_last.append(mean_absolute_error(te_df["strain"].values, last.values))

    def s(x): return f"{np.mean(x):.2f} ± {np.std(x):.2f}"
    print("\nMAE (lower = better), 5-fold person-held-out:")
    print(f"  Stage-1 model      : {s(mae_model)}")
    print(f"  Personal-mean base : {s(mae_pmean)}   <- the bar that matters")
    print(f"  Last-observed base : {s(mae_last)}")
    print(f"  Global-mean base   : {s(mae_gmean)}")

    # feature importance on a full fit
    full = LGBMRegressor(n_estimators=300, learning_rate=0.03, num_leaves=15, verbose=-1).fit(X, y)
    imp = pd.Series(full.feature_importances_, index=feature_cols).sort_values(ascending=False)
    print("\nTop 8 features:\n" + imp.head(8).to_string())


if __name__ == "__main__":
    run()
