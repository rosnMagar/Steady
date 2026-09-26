"""Bite D: honest backtest of the load forecast.

Hold out each person's last HORIZON days, train ML.FORECAST on the rest, forecast HORIZON days,
compare to the held-out actuals. Report MAE vs naive baselines, and elevated-day detection.
Also saves an actual-vs-forecast plot for a few people.
"""
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from .prep_series import prepared_series
from .snowflake_io import connect, load_dataframe, query

HORIZON = 7
REPORTS = Path(__file__).resolve().parent.parent / "reports"


def run():
    full = prepared_series()
    # split: last HORIZON days per person = holdout; need enough train history
    parts_tr, parts_ho = [], []
    for pid, g in full.groupby("person_id"):
        g = g.sort_values("date")
        if len(g) < 30 + HORIZON:
            continue
        parts_tr.append(g.iloc[:-HORIZON])
        parts_ho.append(g.iloc[-HORIZON:])
    train = pd.concat(parts_tr, ignore_index=True)
    holdout = pd.concat(parts_ho, ignore_index=True)
    people = train["person_id"].nunique()
    print(f"backtest: {people} people, train {len(train)} rows, holdout {len(holdout)} rows")

    # load train into a scratch table and forecast
    tr = train.rename(columns={"load_smooth": "strain_score"})
    tr["date"] = tr["date"].dt.date
    with connect() as c:
        cur = c.cursor()
        cur.execute("CREATE OR REPLACE TABLE BT_INPUT (person_id STRING, date DATE, strain_score FLOAT)")
    load_dataframe(tr[["person_id", "date", "strain_score"]], "BT_INPUT")

    with connect() as c:
        cur = c.cursor()
        cur.execute("""CREATE OR REPLACE SNOWFLAKE.ML.FORECAST bt_model(
            INPUT_DATA => TABLE(SELECT person_id, date, strain_score FROM BT_INPUT),
            SERIES_COLNAME => 'PERSON_ID', TIMESTAMP_COLNAME => 'DATE', TARGET_COLNAME => 'STRAIN_SCORE')""")
        cur.execute(f"CALL bt_model!FORECAST(FORECASTING_PERIODS => {HORIZON})")
        rows = cur.fetchall()
        cols = [d[0].lower() for d in cur.description]
    fc = pd.DataFrame(rows, columns=cols).rename(columns={"series": "person_id", "ts": "date"})
    fc["person_id"] = fc["person_id"].str.strip('"')
    fc["date"] = pd.to_datetime(fc["date"]).dt.normalize()
    holdout["date"] = pd.to_datetime(holdout["date"]).dt.normalize()

    m = holdout.merge(fc[["person_id", "date", "forecast", "lower_bound", "upper_bound"]],
                      on=["person_id", "date"], how="inner")
    print(f"matched {len(m)} holdout/forecast rows")

    # baselines per person: persistence (last train value) and personal train mean
    last_val = tr.sort_values("date").groupby("person_id")["strain_score"].last()
    mean_val = tr.groupby("person_id")["strain_score"].mean()
    m["persist"] = m["person_id"].map(last_val)
    m["pmean"] = m["person_id"].map(mean_val)

    def mae(a, b): return float(np.mean(np.abs(np.asarray(a) - np.asarray(b))))
    res = {
        "mae_model": mae(m["load_smooth"], m["forecast"]),
        "mae_persist": mae(m["load_smooth"], m["persist"]),
        "mae_pmean": mae(m["load_smooth"], m["pmean"]),
    }
    # per-person: does the model beat persistence?
    beat = m.groupby("person_id").apply(
        lambda g: mae(g["load_smooth"], g["forecast"]) < mae(g["load_smooth"], g["persist"]))
    res["pct_beat_persist"] = float(beat.mean())

    # elevated-day detection: elevated = actual >= person's train p75
    p75 = tr.groupby("person_id")["strain_score"].quantile(0.75)
    m["thr"] = m["person_id"].map(p75)
    act_hi = m["load_smooth"] >= m["thr"]
    pred_hi = m["forecast"] >= m["thr"]
    tp = int((act_hi & pred_hi).sum()); fp = int((~act_hi & pred_hi).sum()); fn = int((act_hi & ~pred_hi).sum())
    res["alert_precision"] = tp / (tp + fp) if tp + fp else float("nan")
    res["alert_recall"] = tp / (tp + fn) if tp + fn else float("nan")

    print("\n=== BACKTEST RESULTS (pooled over horizon) ===")
    print(f"  MAE  model={res['mae_model']:.2f}  persistence={res['mae_persist']:.2f}  personal-mean={res['mae_pmean']:.2f}")
    print(f"  model beats persistence for {res['pct_beat_persist']*100:.0f}% of people")
    print(f"  elevated-day  precision={res['alert_precision']:.2f}  recall={res['alert_recall']:.2f}")

    # per-horizon-day breakdown: MAE at day 1, 2, ... HORIZON
    m["h"] = m.groupby("person_id")["date"].rank(method="first").astype(int)
    print("\n=== MAE BY HORIZON DAY ===")
    print("  day |  model | persist | p-mean")
    by_h = []
    for h, g in m.groupby("h"):
        row = (h, mae(g["load_smooth"], g["forecast"]), mae(g["load_smooth"], g["persist"]), mae(g["load_smooth"], g["pmean"]))
        by_h.append(row)
        print(f"  {h:3d} | {row[1]:6.2f} | {row[2]:7.2f} | {row[3]:6.2f}")

    _write_metrics(res)
    _plot(train, holdout, fc)
    _plot_horizon(by_h)
    return res


def _plot_horizon(by_h):
    import numpy as _np
    h = [r[0] for r in by_h]
    plt.figure(figsize=(7, 4.5))
    plt.plot(h, [r[1] for r in by_h], "o-", color="#d97706", label="model")
    plt.plot(h, [r[2] for r in by_h], "s--", color="#0d9488", label="persistence")
    plt.plot(h, [r[3] for r in by_h], "^:", color="#888", label="personal-mean")
    plt.xlabel("forecast horizon (days ahead)"); plt.ylabel("MAE (0-100)")
    plt.title("Forecast accuracy by horizon"); plt.legend(); plt.grid(alpha=0.3)
    plt.tight_layout()
    plt.savefig(REPORTS / "backtest_by_horizon.png", dpi=110)
    print(f"  saved plot -> {REPORTS / 'backtest_by_horizon.png'}")


def _write_metrics(res):
    rows = [
        ("mae", res["mae_model"], "model", "forecast vs held-out actual, 0-100"),
        ("mae", res["mae_persist"], "naive_persistence", "carry last value forward"),
        ("mae", res["mae_pmean"], "naive_personal_mean", "predict personal mean"),
        ("pct_beat_persistence", res["pct_beat_persist"], "model", "share of people model beats persistence"),
        ("alert_precision", res["alert_precision"], "model", "elevated-day (>= train p75)"),
        ("alert_recall", res["alert_recall"], "model", "elevated-day (>= train p75)"),
    ]
    df = pd.DataFrame(rows, columns=["metric", "value", "split", "notes"])
    with connect() as c:
        c.cursor().execute("TRUNCATE TABLE BACKTEST_METRICS")
    load_dataframe(df, "BACKTEST_METRICS")
    print("  wrote BACKTEST_METRICS")


def _plot(train, holdout, fc, n=6):
    REPORTS.mkdir(exist_ok=True)
    ids = holdout["person_id"].drop_duplicates().iloc[:n]
    fig, axes = plt.subplots(2, 3, figsize=(15, 7), sharey=True)
    for ax, pid in zip(axes.ravel(), ids):
        tr = train[train.person_id == pid].sort_values("date")
        ho = holdout[holdout.person_id == pid].sort_values("date")
        f = fc[fc.person_id == pid].sort_values("date")
        ax.plot(tr["date"].tail(30), tr["load_smooth"].tail(30), color="#0d9488", label="history")
        ax.plot(ho["date"], ho["load_smooth"], color="#111", lw=2, label="actual (held out)")
        ax.plot(f["date"], f["forecast"], color="#d97706", ls="--", label="forecast")
        ax.fill_between(f["date"], f["lower_bound"], f["upper_bound"], color="#d97706", alpha=0.15)
        ax.set_title(pid[:10]); ax.tick_params(labelsize=8)
    axes.ravel()[0].legend(fontsize=8)
    fig.suptitle("Load forecast vs held-out actual (last 14 days)", fontsize=13)
    fig.tight_layout()
    out = REPORTS / "backtest_examples.png"
    fig.savefig(out, dpi=110)
    print(f"  saved plot -> {out}")


if __name__ == "__main__":
    run()
