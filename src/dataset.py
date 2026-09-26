"""Load LifeSnaps daily data and build the strain target.

strain (0-100) is derived from the binary SEMA mood flags (multi-label self-reports).
See Bite A: negative affect raises strain, positive recovery lowers it.
"""
from pathlib import Path
import pandas as pd

DAILY_CSV = Path(__file__).resolve().parent.parent / "data" / "lifesnaps_csv" / "daily_fitbit_sema_df_unprocessed.csv"

MOOD_COLS = ["ALERT", "HAPPY", "NEUTRAL", "RESTED/RELAXED", "SAD", "TENSE/ANXIOUS", "TIRED"]

# Hand-set weights (transparent, defensible). PCA is used only as a cross-check in strain_model.py.
STRAIN_WEIGHTS = {"TENSE/ANXIOUS": 1.0, "SAD": 1.0, "TIRED": 0.8, "RESTED/RELAXED": -0.7, "HAPPY": -0.7}
_RAW_LO, _RAW_HI = -1.4, 2.8  # theoretical min/max of the weighted sum

# Wearable signals we model from. resting_hr + steps are the reliable backbone (~60-65% coverage);
# the rest are supporting features with more missingness.
WEARABLE_COLS = [
    "resting_hr", "steps", "minutesAsleep", "sleep_efficiency",
    "rmssd", "nremhr", "very_active_minutes", "sedentary_minutes", "calories",
]


def load_daily() -> pd.DataFrame:
    """Return daily rows with person_id, date, wearable columns, and strain (NaN when unlabeled)."""
    df = pd.read_csv(DAILY_CSV)
    df = df.rename(columns={"id": "person_id"})
    df["date"] = pd.to_datetime(df["date"])
    df = df.sort_values(["person_id", "date"]).reset_index(drop=True)

    raw = sum(df[c] * w for c, w in STRAIN_WEIGHTS.items())  # NaN where mood unlabeled
    df["strain"] = ((raw - _RAW_LO) / (_RAW_HI - _RAW_LO) * 100).clip(0, 100)

    keep = ["person_id", "date", "strain"] + [c for c in WEARABLE_COLS if c in df.columns] + MOOD_COLS
    return df[keep]


if __name__ == "__main__":
    d = load_daily()
    print(d.shape)
    print(d[["strain"] + WEARABLE_COLS].describe().round(1).T.to_string())
