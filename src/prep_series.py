"""Shared prep: turn the raw load index into a clean, regular daily series per person.
Used by both the production forecast load and the backtest so they see identical inputs.
"""
import pandas as pd
from .load_index import build


def prepared_series(min_days: int = 30, window: int = 120,
                    indexed: pd.DataFrame | None = None) -> pd.DataFrame:
    """Return columns person_id, date, load_smooth on a regular daily grid (<=3-day gaps bridged).
    Defaults to the LifeSnaps load index; pass `indexed` (output of load_index.build) to reuse this
    on live data without re-reading the CSV."""
    d = indexed if indexed is not None else build()
    d = d[d["load_n_components"] >= 2][["person_id", "date", "load"]].copy()
    out = []
    for pid, g in d.groupby("person_id"):
        s = g.set_index("date")["load"].sort_index()
        s = s[~s.index.duplicated()].asfreq("D")
        s = s.interpolate(limit=3, limit_area="inside").dropna()
        if len(s) < min_days:
            continue
        s = s.iloc[-window:]
        sm = s.ewm(span=3, min_periods=1).mean()
        out.append(pd.DataFrame({"person_id": pid, "date": sm.index, "load_smooth": sm.values}))
    if not out:  # nobody has enough usable history (e.g. a live person still backfilling)
        return pd.DataFrame(columns=["person_id", "date", "load_smooth"])
    return pd.concat(out, ignore_index=True)
