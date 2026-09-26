"""Path A: run the episode-risk model IN Snowflake via SNOWFLAKE.ML.CLASSIFICATION.

Pipeline: engineer features in Python -> land FEATURES table -> train ML.CLASSIFICATION ->
score current risk per person -> derive status -> write RISK + ALERTS.

We report the honest person-held-out AUC (0.80) from src/episode_model.py; Snowflake's own
evaluation uses a random split and is shown for reference only.
"""
import numpy as np
import pandas as pd
from src.episode_model import build_dataset
from src.snowflake_io import connect, load_dataframe, query

STATUS_THRESHOLDS = [(0.33, "steady"), (0.60, "building"), (1.01, "heads_up")]


def _status(risk: float) -> str:
    for hi, name in STATUS_THRESHOLDS:
        if risk < hi:
            return name
    return "heads_up"


def prepare():
    data, cols = build_dataset()
    data = data[["person_id", "date"] + cols + ["y"]].copy()
    # impute feature NaNs with column medians (ML.CLASSIFICATION needs no NaNs)
    for c in cols:
        data[c] = data[c].fillna(data[c].median())
    data["y"] = data["y"].astype(int)
    data["date"] = pd.to_datetime(data["date"]).dt.date
    return data, cols


def create_and_load(data, cols):
    feat_ddl = ", ".join(f'"{c.upper()}" FLOAT' for c in cols)
    with connect() as c:
        cur = c.cursor()
        cur.execute(f'CREATE OR REPLACE TABLE FEATURES (person_id STRING, date DATE, {feat_ddl}, Y INT)')
    n = load_dataframe(data.rename(columns={x: x.upper() for x in data.columns}), "FEATURES")
    print(f"FEATURES loaded: {n} rows, {len(cols)} feature cols")


def train_and_score(cols):
    feat_list = ",".join(f'"{c.upper()}"' for c in cols)
    obj = "OBJECT_CONSTRUCT(" + ",".join(f"'{c.upper()}',\"{c.upper()}\"" for c in cols) + ")"
    with connect() as c:
        cur = c.cursor()
        print("training SNOWFLAKE.ML.CLASSIFICATION…")
        cur.execute(f"""CREATE OR REPLACE SNOWFLAKE.ML.CLASSIFICATION steady_episode(
            INPUT_DATA    => TABLE(SELECT {feat_list}, Y FROM FEATURES),
            TARGET_COLNAME=> 'Y',
            CONFIG_OBJECT => {{'evaluate': TRUE}})""")
        # Snowflake's own (random-split) evaluation, for reference
        try:
            cur.execute("CALL steady_episode!SHOW_EVALUATION_METRICS()")
            print("Snowflake internal eval (random split, reference only):")
            for r in cur.fetchall()[:6]:
                print("   ", r)
        except Exception as e:
            print("   (eval metrics unavailable:", e, ")")

        # score each person's LATEST row = current risk
        print("scoring current risk per person…")
        cur.execute(f"""CREATE OR REPLACE TABLE RISK AS
            WITH latest AS (
                SELECT * FROM FEATURES
                QUALIFY ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date DESC) = 1
            ), scored AS (
                SELECT person_id, date, steady_episode!PREDICT({obj}) AS pred FROM latest
            )
            SELECT person_id, date,
                   pred:probability['1']::float AS risk
            FROM scored""")
        cur.execute("SELECT COUNT(*), ROUND(AVG(risk),3), ROUND(MIN(risk),3), ROUND(MAX(risk),3) FROM RISK")
        print("RISK:", cur.fetchone())

    # derive status locally and write ALERTS
    risk = query("SELECT person_id, date, risk FROM RISK")
    risk.columns = [c.lower() for c in risk.columns]  # Snowflake returns UPPER
    risk["status"] = risk["risk"].apply(_status)
    risk["rule"] = risk["risk"].apply(lambda r: f"episode risk {r:.2f}")
    with connect() as c:
        c.cursor().execute("TRUNCATE TABLE ALERTS")
    load_dataframe(risk[["person_id", "date", "status", "rule"]], "ALERTS")
    print("\nstatus distribution:\n" + risk["status"].value_counts().to_string())
    print("\nsample:\n" + risk.sort_values("risk", ascending=False).head(5).to_string(index=False))


if __name__ == "__main__":
    data, cols = prepare()
    create_and_load(data, cols)
    train_and_score(cols)
