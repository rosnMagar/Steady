"""Score LIVE (Apple Watch) participants through the same pipeline as the demo cohort.

The existing pipeline reads the LifeSnaps CSV. Live wearable data instead arrives via the iPhone
Shortcut into Snowflake's RAW_DAILY (source='apple_watch'). This runner closes the loop:

    RAW_DAILY (live)  ->  features + load index  ->  STRAIN_SCORE  ->  ML.FORECAST (7d)  ->  RISK
                                    (build_features / load_index — identical code to the demo)

so an ingesting participant actually appears in the app. It is SCOPED: it only ever writes rows for
the live person_ids it scores (DELETE+insert on those ids), never touching the demo cohort.

Honest-framing note (see CLAUDE.md): the episode-risk CLASSIFIER is trained on Fitbit data with
differently-defined metrics, so we do NOT run it on the live participant. Instead the live person's
status is derived from their OWN forecast vs their OWN baseline — 'building' when the 7-day forecast
crosses their personal p75, 'heads_up' when it reaches their p90. Same personal-baseline logic the
rest of the system uses, expressed through the forecast alone. It's a live-pipeline demo, not model
validation for this participant.

Usage:
    .venv/bin/python -m src.score_live                 # score every source='apple_watch' person
    .venv/bin/python -m src.score_live p_roshan        # score specific person_id(s)
    .venv/bin/python -m src.score_live --dry-run        # compute + print, write nothing to Snowflake
"""
from __future__ import annotations
import math
import sys

import numpy as np
import pandas as pd

from .load_index import build
from .prep_series import prepared_series
from .snowflake_io import connect, query as _sf_query, load_dataframe

# RAW_DAILY column  ->  the name build_features / dataset.WEARABLE_COLS expect.
# Apple Watch supplies a subset of what LifeSnaps had; absent signals (nremhr, very/sedentary
# minutes) just drop out of the load index, which already nan-means over whatever is present.
RAW_TO_DAILY = {
    "resting_hr": "resting_hr",
    "steps": "steps",
    "sleep_minutes": "minutesAsleep",
    "sleep_efficiency": "sleep_efficiency",
    "hrv_ms": "rmssd",
    "calories": "calories",
}
MODEL_VERSION = "load_index_v1"
MIN_DAYS = 30  # prepared_series floor: fewer usable days => no stable baseline => person is skipped


def _phi(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def _quote_ids(ids: list[str]) -> str:
    return ",".join("'" + str(i).replace("'", "''") + "'" for i in ids)


# ── read + shape ──────────────────────────────────────────────────────────────
def read_raw(person_ids: list[str] | None = None) -> pd.DataFrame:
    """Pull RAW_DAILY for the target people (or all source='apple_watch' rows) from Snowflake."""
    where = (f"person_id IN ({_quote_ids(person_ids)})" if person_ids
             else "source = 'apple_watch'")
    df = _sf_query(f"SELECT * FROM RAW_DAILY WHERE {where}")
    df.columns = [c.lower() for c in df.columns]
    return df


def daily_from_raw(person_ids: list[str] | None = None, raw: pd.DataFrame | None = None) -> pd.DataFrame:
    """Return a dataset.load_daily-shaped frame from RAW_DAILY: person_id, date (datetime),
    the mapped wearable columns, and a NaN strain column (live data has no mood labels)."""
    raw = raw if raw is not None else read_raw(person_ids)
    if raw.empty:
        return pd.DataFrame(columns=["person_id", "date", "strain", *RAW_TO_DAILY.values()])
    out = pd.DataFrame({"person_id": raw["person_id"].astype(str),
                        "date": pd.to_datetime(raw["date"])})
    for src, dst in RAW_TO_DAILY.items():
        if src in raw.columns:
            out[dst] = pd.to_numeric(raw[src], errors="coerce")
    out["strain"] = np.nan
    return out.sort_values(["person_id", "date"]).reset_index(drop=True)


# ── compute (pure; no Snowflake) ──────────────────────────────────────────────
def strain_rows(indexed: pd.DataFrame) -> pd.DataFrame:
    """The forecastable series: smoothed load per person on a regular daily grid (== STRAIN_SCORE)."""
    s = prepared_series(min_days=MIN_DAYS, indexed=indexed)
    if s.empty:
        return s
    return s.rename(columns={"load_smooth": "strain_score"}).assign(model_version=MODEL_VERSION)


def feature_rows(indexed: pd.DataFrame, keep_person_ids: set[str]) -> pd.DataFrame:
    """Per-day engineered features for the FEATURES table (drives the metrics panel + drivers).
    Only columns that already exist in FEATURES are written; the rest stay NULL for the live person."""
    feat_cols = list(indexed.attrs.get("feature_cols", []))
    cols = ["person_id", "date", *feat_cols]
    df = indexed[indexed["person_id"].isin(keep_person_ids)][cols].copy()
    return df


def person_risk(strain: pd.DataFrame, forecasts: pd.DataFrame) -> pd.DataFrame:
    """Forecast-derived status signal per person (honest substitute for the OOD classifier):
    risk = P(peak forecast >= personal p90). status_of then reads it as heads_up>=0.5; the 'building'
    tier still comes from the forecast crossing p75 inside server/repo.status_of."""
    rows = []
    for pid, g in strain.groupby("person_id"):
        p75 = float(g["strain_score"].quantile(0.75))
        p90 = float(g["strain_score"].quantile(0.90))
        fc = forecasts[forecasts["person_id"] == pid]
        if fc.empty:
            continue
        peak = fc.loc[fc["forecast"].idxmax()]
        fpeak = float(peak["forecast"])
        sd = max((float(peak["upper_bound"]) - float(peak["lower_bound"])) / (2 * 1.96), 1e-6)
        risk = 1.0 - _phi((p90 - fpeak) / sd)
        rows.append({"person_id": pid, "date": g["date"].max(),
                     "risk": round(min(max(risk, 0.0), 1.0), 4)})
    return pd.DataFrame(rows)


# ── write (scoped to the live person_ids only) ───────────────────────────────
def _replace_rows(table: str, person_ids: list[str], df: pd.DataFrame, table_cols: set[str]):
    """DELETE this table's rows for these people, then append df (only columns the table has)."""
    if df.empty:
        return 0
    df = df.copy()
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"]).dt.date  # Snowflake DATE, not TIMESTAMP
    cols = [c for c in df.columns if c.upper() in table_cols]
    df = df[cols]
    with connect() as c:
        c.cursor().execute(f"DELETE FROM {table} WHERE person_id IN ({_quote_ids(person_ids)})")
    return load_dataframe(df, table)


def _table_columns(table: str) -> set[str]:
    d = _sf_query(f"SELECT * FROM {table} WHERE 1=0")
    return {c.upper() for c in d.columns}


def forecast_into_snowflake(person_ids: list[str]) -> pd.DataFrame:
    """Train ML.FORECAST on just these people's STRAIN_SCORE history and project 7 days."""
    ids = _quote_ids(person_ids)
    with connect() as c:
        cur = c.cursor()
        cur.execute(f"""CREATE OR REPLACE SNOWFLAKE.ML.FORECAST steady_live_model(
            INPUT_DATA => TABLE(SELECT person_id, date, strain_score FROM STRAIN_SCORE
                                WHERE person_id IN ({ids})),
            SERIES_COLNAME => 'PERSON_ID', TIMESTAMP_COLNAME => 'DATE',
            TARGET_COLNAME => 'STRAIN_SCORE')""")
        cur.execute("CALL steady_live_model!FORECAST(FORECASTING_PERIODS => 7)")
        rows = cur.fetchall()
        cols = [d[0].lower() for d in cur.description]
    fc = pd.DataFrame(rows, columns=cols).rename(columns={"series": "person_id", "ts": "date"})
    fc["person_id"] = fc["person_id"].astype(str).str.strip('"')
    fc["date"] = pd.to_datetime(fc["date"]).dt.normalize()
    return fc[["person_id", "date", "forecast", "lower_bound", "upper_bound"]]


# ── orchestration ─────────────────────────────────────────────────────────────
def run(person_ids: list[str] | None = None, dry_run: bool = False) -> dict:
    daily = daily_from_raw(person_ids)
    if daily.empty:
        print("No RAW_DAILY rows found for the requested live person(s). "
              "Has the phone ingested / backfilled yet?")
        return {"scored": [], "skipped": [], "days": 0}

    indexed = build(daily=daily)
    strain = strain_rows(indexed)
    scored = sorted(strain["person_id"].unique().tolist())
    requested = sorted(daily["person_id"].unique().tolist())
    skipped = [p for p in requested if p not in scored]
    if skipped:
        print(f"skipped (< {MIN_DAYS} usable days of signal — backfill more history): {skipped}")
    if not scored:
        return {"scored": [], "skipped": skipped, "days": 0}

    feats = feature_rows(indexed, set(scored))
    print(f"scoring {len(scored)} live person(s): {scored}")
    print(f"  STRAIN_SCORE rows: {len(strain)} | FEATURES rows: {len(feats)}")

    if dry_run:
        print("[dry-run] nothing written to Snowflake.")
        print(strain.groupby("person_id")["strain_score"].agg(["count", "mean", "max"]).round(1).to_string())
        return {"scored": scored, "skipped": skipped, "days": len(strain), "dry_run": True}

    ss_cols, ft_cols = _table_columns("STRAIN_SCORE"), _table_columns("FEATURES")
    _replace_rows("STRAIN_SCORE", scored, strain, ss_cols)
    _replace_rows("FEATURES", scored, feats, ft_cols)

    forecasts = forecast_into_snowflake(scored)
    fc_cols = _table_columns("FORECASTS")
    _replace_rows("FORECASTS", scored, forecasts, fc_cols)

    risk = person_risk(strain, forecasts)
    rk_cols = _table_columns("RISK")
    _replace_rows("RISK", scored, risk, rk_cols)

    print("done. forecast peak vs baseline per person:")
    for _, r in risk.iterrows():
        print(f"  {r['person_id']}: risk={r['risk']}")
    return {"scored": scored, "skipped": skipped, "days": len(strain),
            "forecasts": len(forecasts), "risk": len(risk)}


def main(argv: list[str]):
    args = [a for a in argv if not a.startswith("-")]
    dry = "--dry-run" in argv
    run(person_ids=args or None, dry_run=dry)


if __name__ == "__main__":
    main(sys.argv[1:])
