"""Reframed forecast: predict an ELEVATED-LOAD EPISODE in the next 1-3 days (classification).

Literature: next-day stress *classification* works where point-value regression fails, but the
headline F1>0.8 numbers are lab/internal-validation results. On real-world external data the same
models drop to ~F1 0.58, and personalized approaches report F1 0.62-0.66 (see docs/RESEARCH.md
section 5). That real-world band is the bar this model should be judged against, not the lab one.
Target at day t: is the mean smoothed load over t+1..t+3 above the person's own
elevated threshold (their 70th percentile)? Features use only info available at day t.

Baselines: base rate, and a PERSISTENCE classifier (elevated-today -> elevated-next). The model
must beat persistence for wearable trends to add value.
"""
import numpy as np
import pandas as pd
from sklearn.model_selection import GroupKFold
from sklearn.metrics import roc_auc_score, f1_score, precision_score, recall_score
from lightgbm import LGBMClassifier

from src.load_index import build

HORIZON = 3
PCTL = 0.70


def build_dataset():
    df = build()
    df = df[df["load_n_components"] >= 2].copy()
    feat_cols = list(df.attrs["feature_cols"])
    rows = []
    for pid, g in df.groupby("person_id"):
        g = g.sort_values("date").copy()
        if len(g) < 25:
            continue
        thr = g["load_smooth"].quantile(PCTL)  # personal elevated threshold
        # autoregressive features available at day t
        g["load_lag1"] = g["load_smooth"].shift(1)
        g["load_lag3"] = g["load_smooth"].shift(3)
        g["load_trend3"] = g["load_smooth"] - g["load_smooth"].shift(3)
        g["load_trend7"] = g["load_smooth"] - g["load_smooth"].shift(7)
        g["load_pmean"] = g["load_smooth"].expanding().mean().shift(1)
        g["load_std7"] = g["load_smooth"].rolling(7, min_periods=3).std()          # recent volatility
        g["load_vs_pmean"] = g["load_smooth"] - g["load_pmean"]                     # elevation vs own norm
        g["dow"] = g["date"].dt.dayofweek
        g["is_weekend"] = (g["date"].dt.dayofweek >= 5).astype(int)
        # recency: days since load was last at/above the personal threshold
        thr_tmp = g["load_smooth"].quantile(PCTL)
        above = g["load_smooth"] >= thr_tmp
        days_since = []
        last = np.nan
        for i, a in enumerate(above):
            days_since.append(np.nan if np.isnan(last) else i - last)
            if a:
                last = i
        g["days_since_elevated"] = days_since
        # weekly variability of the two most-important wearables
        for col in ["resting_hr", "rmssd"]:
            if col in g.columns:
                g[f"{col}_std7"] = g[col].rolling(7, min_periods=3).std()
        # target: mean load over next HORIZON days >= personal threshold
        fut = g["load_smooth"].shift(-1).rolling(HORIZON).mean().shift(-(HORIZON - 1))
        g["y"] = (fut >= thr).astype(float)
        g["persist_pred"] = (g["load_smooth"] >= thr).astype(int)  # elevated today
        g["thr"] = thr
        g = g.iloc[:-HORIZON]  # drop rows without a full future window
        rows.append(g)
    data = pd.concat(rows, ignore_index=True).dropna(subset=["y", "load_lag3", "load_pmean"])
    ar_cols = ["load_smooth", "load_lag1", "load_lag3", "load_trend3", "load_trend7", "load_pmean",
               "load_std7", "load_vs_pmean", "dow", "is_weekend", "days_since_elevated",
               "resting_hr_std7", "rmssd_std7"]
    ar_cols = [c for c in ar_cols if c in data.columns]
    return data, feat_cols + ar_cols


def run():
    data, cols = build_dataset()
    X, y, grp = data[cols], data["y"].values.astype(int), data["person_id"].values
    print(f"{len(data)} samples, {data['person_id'].nunique()} people, {len(cols)} features")
    print(f"elevated-episode base rate: {y.mean():.2f}")

    aucs, m_p, m_r, m_f1, p_p, p_r, p_f1 = [], [], [], [], [], [], []
    for tr, te in GroupKFold(5).split(X, y, grp):
        m = LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=15,
                           min_child_samples=20, subsample=0.8, colsample_bytree=0.8, verbose=-1)
        m.fit(X.iloc[tr], y[tr])
        proba = m.predict_proba(X.iloc[te])[:, 1]
        aucs.append(roc_auc_score(y[te], proba))
        # pick decision threshold on TRAIN (maximize F1), apply to test — no leakage
        ptr = m.predict_proba(X.iloc[tr])[:, 1]
        grid = np.linspace(0.1, 0.9, 33)
        thr = grid[np.argmax([f1_score(y[tr], (ptr >= t).astype(int)) for t in grid])]
        pred = (proba >= thr).astype(int)
        m_p.append(precision_score(y[te], pred, zero_division=0))
        m_r.append(recall_score(y[te], pred))
        m_f1.append(f1_score(y[te], pred))
        pp = data.iloc[te]["persist_pred"].values  # persistence: elevated-today
        p_p.append(precision_score(y[te], pp, zero_division=0))
        p_r.append(recall_score(y[te], pp))
        p_f1.append(f1_score(y[te], pp))

    def s(x): return f"{np.mean(x):.3f}"
    print("\n=== EPISODE CLASSIFICATION (person-held-out, 5-fold, train-tuned threshold) ===")
    print(f"  Model AUC       : {np.mean(aucs):.3f} ± {np.std(aucs):.3f}  (0.5 = chance)")
    print(f"                     precision  recall   F1")
    print(f"  Model          :   {s(m_p)}     {s(m_r)}   {s(m_f1)}")
    print(f"  Persistence    :   {s(p_p)}     {s(p_r)}   {s(p_f1)}")

    full = LGBMClassifier(n_estimators=300, learning_rate=0.03, num_leaves=15, verbose=-1).fit(X, y)
    imp = pd.Series(full.feature_importances_, index=cols).sort_values(ascending=False)
    print("\nTop 8 features:\n" + imp.head(8).to_string())


if __name__ == "__main__":
    run()
