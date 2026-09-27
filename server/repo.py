"""Read/assemble Snowflake results into the exact JSON shapes the front end expects
(server/API_CONTRACT.md, mirrored by web/src/mocks/*.json), plus the ingest writers.

Everything the model produced already lives in Snowflake (STRAIN_SCORE, FORECASTS, RISK, ALERTS,
BRIEFS, PROGRAMS, BACKTEST_METRICS). This module only shapes and serves it — no new modeling.
"""
from __future__ import annotations
import math
import re
from datetime import date, timedelta

import pandas as pd

from src.briefs import BANNED, MODEL as CORTEX_MODEL
from src.snowflake_io import query as _sf_query, connect
from server import demo, store
from server.cache import cached
from server.config import HEADS_UP_RISK, DEMO_CAREGIVER_ID

NOTE_DISCLAIMER = "AI-written, not medical advice."
CRISIS_NOTE = "If you are in crisis or thinking about harming yourself, call or text 988 anytime."
BASELINE_DAYS = 14  # days of history before a personal baseline is considered "ready"

# Person-scoped tables, for export/delete (privacy controls).
PERSON_TABLES = ["RAW_DAILY", "LABELS", "STRAIN_SCORE", "FORECASTS", "FEATURES", "RISK",
                 "ALERTS", "BRIEFS"]

# Deterministic "why this program" lines, keyed by the program's leading tag. Not model output —
# a fixed, honest gloss so each matched card explains itself without the LLM inventing anything.
_WHY_BY_TAG = {
    "respite": "A few hours of respite care could give you a real break.",
    "navigation": "Help finding and coordinating the right services for your situation.",
    "emotional_support": "Someone to talk through what you're carrying right now.",
    "peer_support": "Connect with others going through the same thing.",
    "counseling": "Confidential support to talk things through.",
    "veterans": "Support tailored to caregivers of veterans.",
    "financial": "Help with the financial side of caregiving.",
    "education": "Practical, plain-language guidance for what you're facing.",
    "dementia": "Specialist guidance for dementia caregiving.",
    "crisis": "Immediate help any time, day or night.",
}

_HEADLINE = {
    "steady": "Things are looking steady this week.",
    "building": "A little more load than usual is building.",
    "heads_up": "This week could be a heavier stretch than usual.",
}

# Non-medical, general self-care nudges keyed by the driver label that's elevated. Deterministic (not
# LLM) and framed as general wellbeing ideas — never advice, diagnosis, or a substitute for care.
_SELF_CARE_BY_LABEL = {
    "Sleep": ("Protect your sleep",
              "Even 20 extra minutes helps. A consistent wind-down and keeping screens out of the last "
              "half hour before bed can make it easier to fall asleep."),
    "Sleep quality": ("Ease into rest",
                      "A short, screen-free wind-down — dim lights and a few slow breaths — can help the "
                      "sleep you do get feel more restorative."),
    "Resting heart rate": ("Give your body a reset",
                          "A few minutes of slow breathing (in for 4, out for 6), once or twice a day, "
                          "can help your body settle when things feel busy."),
    "Recovery (HRV)": ("Build in recovery",
                      "Short breaks between tasks — a walk, a stretch, a quiet cup of tea — give your "
                      "body room to recover during a heavier stretch."),
    "Activity": ("Keep moving gently",
                "A brief walk outside, even 10 minutes, is a reliable way to steady both mood and energy."),
    "Overall load": ("Pace the week",
                    "Pick one thing to hand off or postpone this week. Lightening the load a little is a "
                    "form of caring for yourself too."),
}
_GENERAL_SELF_CARE = [
    ("Small breaks count", "A few minutes to yourself between tasks adds up. You don't have to earn rest."),
    ("Stay connected", "A quick message to a friend or family member can lighten a heavy day — you're not meant to do this alone."),
]
SELF_CARE_DISCLAIMER = "General wellbeing ideas, not medical advice."

# Friendly category label per program, chosen by the first matching tag in priority order.
_CATEGORY_ORDER = [
    ("respite", "Respite & breaks"),
    ("emotional_support", "Emotional support"),
    ("peer_support", "Peer support"),
    ("counseling", "Counseling"),
    ("navigation", "Finding services"),
    ("education", "Learning & guidance"),
    ("financial", "Financial help"),
    ("veterans", "Veterans"),
    ("dementia", "Dementia care"),
    ("crisis", "Crisis support"),
]


def _category_for(tags: list[str]) -> str:
    for tag, label in _CATEGORY_ORDER:
        if tag in tags:
            return label
    return "Other support"


def _self_care_for(driver_labels: list[str]) -> list[dict]:
    """Pick up to two self-care nudges matched to the elevated drivers; fall back to general ones."""
    tips, seen = [], set()
    for label in driver_labels:
        hit = _SELF_CARE_BY_LABEL.get(label)
        if hit and hit[0] not in seen:
            tips.append({"title": hit[0], "body": hit[1]})
            seen.add(hit[0])
    for title, body in _GENERAL_SELF_CARE:
        if len(tips) >= 2:
            break
        if title not in seen:
            tips.append({"title": title, "body": body})
            seen.add(title)
    return tips[:2]


# ── helpers ──────────────────────────────────────────────────────────────────
def _q(sql: str) -> pd.DataFrame:
    df = _sf_query(sql)
    df.columns = [c.lower() for c in df.columns]
    return df


def _num(v, ndigits: int | None = 0):
    """Snowflake/numpy scalar -> JSON-safe Python number (or None for NaN/missing)."""
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if math.isnan(f):
        return None
    if ndigits == 0:
        return int(round(f))
    return round(f, ndigits)


def _esc(s: str) -> str:
    return str(s).replace("'", "''")


def status_of(risk, p75, forecast_peak) -> str:
    """heads_up from the episode-risk model; building when the forecast peak crosses the person's
    own top-quartile (load rising toward their heads-up level); steady otherwise."""
    if risk is not None and risk >= HEADS_UP_RISK:
        return "heads_up"
    if forecast_peak is not None and p75 is not None and forecast_peak >= p75:
        return "building"
    return "steady"


@cached()
def _cohort_frame() -> pd.DataFrame:
    """One row per enrolled person with the fields every cohort/status view needs."""
    risk = _q("SELECT person_id, risk FROM RISK")
    stats = _q("""SELECT person_id, MAX(date) last_date, COUNT(*) n, AVG(strain_score) mean,
                         PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY strain_score) p75
                  FROM STRAIN_SCORE GROUP BY person_id""")
    now = _q("""SELECT person_id, strain_score strain_now FROM STRAIN_SCORE
                QUALIFY ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date DESC) = 1""")
    fpk = _q("SELECT person_id, MAX(forecast) fpeak FROM FORECASTS GROUP BY person_id")
    f = (risk.merge(stats, on="person_id", how="left")
             .merge(now, on="person_id", how="left")
             .merge(fpk, on="person_id", how="left"))
    f["status"] = [status_of(r.risk, r.p75, r.fpeak) for r in f.itertuples()]
    return f


def resolve(person_id: str) -> str:
    """Map the caregiver-app alias 'p_demo' to a real person. Prefer the configured live participant
    (DEMO_CAREGIVER_ID) so the caregiver app features real Apple Watch data; fall back to the
    highest-risk person if that id hasn't been scored yet."""
    if person_id != demo.DEMO_ALIAS:
        return person_id
    if DEMO_CAREGIVER_ID:
        hit = _q(f"SELECT person_id FROM RISK WHERE person_id='{_esc(DEMO_CAREGIVER_ID)}'")
        if not hit.empty:
            return DEMO_CAREGIVER_ID
    top = _q("SELECT person_id FROM RISK ORDER BY risk DESC LIMIT 1")
    return top.iloc[0]["person_id"] if not top.empty else person_id


def _person_row(person_id: str):
    f = _cohort_frame()
    hit = f[f["person_id"] == person_id]
    return hit.iloc[0] if not hit.empty else None


# ── drivers ──────────────────────────────────────────────────────────────────
def _drivers(person_id: str) -> list[dict]:
    df = _q(f"""SELECT * FROM FEATURES
                WHERE person_id='{_esc(person_id)}' AND resting_hr IS NOT NULL
                QUALIFY ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date DESC) = 1""")
    if df.empty:
        return [{"label": "Overall load", "detail": "a bit above your usual", "direction": "worse"}]
    r = df.iloc[0].to_dict()

    def g(k):
        return _num(r.get(k), 2)

    worse: list[tuple[float, dict]] = []
    rhr_z = g("resting_hr_z")
    if rhr_z and rhr_z > 0.4:
        d = _num((r.get("resting_hr") or 0) - (r.get("resting_hr_roll7") or 0))
        detail = f"up about {d} bpm vs your usual" if d and d >= 1 else "running higher than your usual"
        worse.append((abs(rhr_z), {"label": "Resting heart rate", "detail": detail, "direction": "worse"}))
    sl_z = g("minutesasleep_z")
    if sl_z and sl_z < -0.4:
        d = _num((r.get("minutesasleep_roll7") or 0) - (r.get("minutesasleep") or 0))
        detail = f"down about {d} min vs your usual" if d and d >= 5 else "shorter than your usual"
        worse.append((abs(sl_z), {"label": "Sleep", "detail": detail, "direction": "worse"}))
    hrv_z = g("rmssd_z")
    if hrv_z and hrv_z < -0.4:
        worse.append((abs(hrv_z), {"label": "Recovery (HRV)", "detail": "lower than your usual",
                                   "direction": "worse"}))
    se_z = g("sleep_efficiency_z")
    if se_z and se_z < -0.4:
        worse.append((abs(se_z), {"label": "Sleep quality", "detail": "below your baseline",
                                  "direction": "worse"}))
    worse.sort(key=lambda x: -x[0])
    out = [d for _, d in worse[:3]]

    if len(out) < 2:  # keep the view calm and informative when little is elevated
        steps_z = g("steps_z")
        if steps_z is not None and -0.4 <= steps_z <= 0.4:
            out.append({"label": "Activity", "detail": "steady with your normal", "direction": "steady"})
        elif sl_z is not None and sl_z >= 0.4:
            out.append({"label": "Sleep", "detail": "a bit more than usual", "direction": "better"})
        else:
            out.append({"label": "Overall load", "detail": "close to your baseline", "direction": "steady"})
    return out


# ── series ───────────────────────────────────────────────────────────────────
def _series(person_id: str, past_days: int) -> list[dict]:
    hist = _q(f"""SELECT date, strain_score FROM STRAIN_SCORE WHERE person_id='{_esc(person_id)}'
                  ORDER BY date DESC LIMIT {past_days}""").sort_values("date")
    fut = _q(f"""SELECT date, forecast, lower_bound, upper_bound FROM FORECASTS
                 WHERE person_id='{_esc(person_id)}' ORDER BY date""")
    pts: list[dict] = []
    for i, row in enumerate(hist.itertuples()):
        anchor = i == len(hist) - 1  # last actual day carries the forecast band's start point
        v = _num(row.strain_score)
        pts.append({"date": str(row.date), "actual": v,
                    "forecast": v if anchor else None,
                    "lower": v if anchor else None, "upper": v if anchor else None})
    for row in fut.itertuples():
        pts.append({"date": str(row.date), "actual": None, "forecast": _num(row.forecast),
                    "lower": _num(row.lower_bound), "upper": _num(row.upper_bound)})
    return pts


# ── caregiver endpoints ──────────────────────────────────────────────────────
@cached()
def today(person_id: str) -> dict:
    pid = resolve(person_id)
    row = _person_row(pid)
    status = row["status"] if row is not None else "steady"
    n = int(row["n"]) if row is not None and pd.notna(row["n"]) else 0
    series = _series(pid, past_days=7)
    as_of = series[-1]["date"] if not series else series[0]["date"]
    # as_of should be the last ACTUAL day
    actual_dates = [p["date"] for p in series if p["actual"] is not None]
    as_of = actual_dates[-1] if actual_dates else (series[0]["date"] if series else str(date.today()))
    return {
        "person_id": person_id,
        "name": demo.display_name(person_id),
        "as_of": as_of,
        "status": status,
        "baseline_ready": n >= BASELINE_DAYS,
        "baseline_days_remaining": max(0, BASELINE_DAYS - n),
        "baseline": _num(row["mean"]) if row is not None else None,
        "headline": _HEADLINE[status],
        "series": series,
        "drivers": _drivers(pid),
    }


def _program_cards(program_ids: list[str], driver_labels: list[str]) -> list[dict]:
    if not program_ids:
        return []
    ids = ",".join(f"'{_esc(p)}'" for p in program_ids)
    progs = _q(f"""SELECT program_id, name, org, COALESCE(description,'') description,
                          COALESCE(eligibility,'') eligibility, COALESCE(phone,'') phone,
                          COALESCE(url,'') url, ARRAY_TO_STRING(tags,'|') tags
                   FROM PROGRAMS WHERE program_id IN ({ids})""")
    by_id = {r["program_id"]: r for _, r in progs.iterrows()}
    cards = []
    used_why: set[str] = set()
    for pid in program_ids:  # preserve the chosen order
        r = by_id.get(pid)
        if r is None:
            continue
        tags = [t for t in str(r["tags"]).split("|") if t]
        # Prefer a reason not already shown on another card, so two cards don't repeat themselves.
        why = next((_WHY_BY_TAG[t] for t in tags if t in _WHY_BY_TAG and _WHY_BY_TAG[t] not in used_why),
                   next((_WHY_BY_TAG[t] for t in tags if t in _WHY_BY_TAG),
                        "A real support program matched to your situation."))
        used_why.add(why)
        cards.append({"program_id": r["program_id"], "name": r["name"], "org": r["org"],
                      "why": why, "description": r["description"], "eligibility": r["eligibility"],
                      "phone": r["phone"], "url": r["url"], "tags": tags})
    return cards


@cached()
def programs_catalog() -> dict:
    """Every real support program, grouped by a friendly category — powers the caregiver app's
    always-on resource library. Cortex never touches this; it's the verified PROGRAMS table verbatim."""
    df = _q("""SELECT program_id, name, org, COALESCE(description,'') description,
                      COALESCE(eligibility,'') eligibility, COALESCE(phone,'') phone,
                      COALESCE(url,'') url, ARRAY_TO_STRING(tags,'|') tags FROM PROGRAMS""")
    items = []
    for _, r in df.iterrows():
        tags = [t for t in str(r["tags"]).split("|") if t]
        items.append({"program_id": r["program_id"], "name": r["name"], "org": r["org"],
                      "description": r["description"], "eligibility": r["eligibility"],
                      "phone": r["phone"], "url": r["url"], "tags": tags,
                      "category": _category_for(tags), "crisis": "crisis" in tags})
    # Crisis resources last (shown as their own always-visible block); otherwise by category order.
    order = {label: i for i, (_, label) in enumerate(_CATEGORY_ORDER)}
    items.sort(key=lambda x: (x["crisis"], order.get(x["category"], 99), x["name"]))
    return {"programs": items}


def _brief(person_id: str, audience: str) -> tuple[str | None, list[str]]:
    df = _q(f"""SELECT body, program_ids FROM BRIEFS
                WHERE person_id='{_esc(person_id)}' AND audience='{audience}'
                ORDER BY date DESC LIMIT 1""")
    if df.empty:
        return None, []
    body = df.iloc[0]["body"]
    raw_ids = df.iloc[0]["program_ids"]
    ids = list(raw_ids) if isinstance(raw_ids, (list, tuple)) else []
    if not ids and isinstance(raw_ids, str):
        import json
        try:
            ids = json.loads(raw_ids)
        except Exception:
            ids = []
    return body, [str(i) for i in ids]


@cached()
def headsup(person_id: str) -> dict:
    pid = resolve(person_id)
    row = _person_row(pid)
    status = row["status"] if row is not None else "steady"
    drivers = [d["label"] for d in _drivers(pid)]
    self_care = _self_care_for(drivers)
    if status == "steady":
        return {"person_id": person_id, "status": status,
                "note": "You're tracking close to your usual this week. Keep doing what works, and "
                        "check back in anytime.",
                "note_disclaimer": NOTE_DISCLAIMER, "programs": [],
                "self_care": self_care, "self_care_disclaimer": SELF_CARE_DISCLAIMER,
                "crisis_note": CRISIS_NOTE}
    body, ids = _brief(pid, "caregiver")
    if not ids:  # building person without a stored brief: pick programs deterministically
        ids = _pick_programs(drivers)
    note = body or ("The next few days look like they could weigh on you a bit more than usual. "
                    "It might be a good moment to line up a little support before things pile up.")
    return {"person_id": person_id, "status": status, "note": note,
            "note_disclaimer": NOTE_DISCLAIMER, "programs": _program_cards(ids, drivers),
            "self_care": self_care, "self_care_disclaimer": SELF_CARE_DISCLAIMER,
            "crisis_note": CRISIS_NOTE}


def _pick_programs(driver_labels: list[str], k: int = 2) -> list[str]:
    """Deterministic tag-priority pick when no stored brief exists. Ids come from PROGRAMS only."""
    want = ["respite", "emotional_support", "navigation", "peer_support", "education"]
    if any("Sleep" in d for d in driver_labels):
        want = ["respite"] + want
    progs = _q("SELECT program_id, ARRAY_TO_STRING(tags,'|') tags FROM PROGRAMS WHERE program_id <> 'lifeline_988'")

    def score(tagstr):
        tags = str(tagstr).split("|")
        return sum((len(want) - want.index(t)) for t in tags if t in want)

    progs["s"] = progs["tags"].apply(score)
    return progs.sort_values("s", ascending=False).head(k)["program_id"].tolist()


# ── metrics (the actual daily signals behind the status) ─────────────────────
# Each: FEATURES column, label, unit, and whether a HIGHER value means more strain.
# higher_worse=None => neutral (shown for context, no good/bad direction).
_METRICS = [
    ("resting_hr",       "Resting heart rate", "bpm", True),
    ("minutesasleep",    "Sleep",              "min", False),
    ("rmssd",            "Heart-rate variability", "ms", False),
    ("sleep_efficiency", "Sleep efficiency",   "%",   False),
    ("steps",            "Steps",              "",    None),
]
METRICS_WINDOW = 21  # days of daily signal history to return


@cached()
def metrics(person_id: str) -> dict:
    """Recent daily wearable signals with each person's own baseline — the evidence behind the status.
    Uses only daily aggregates (never raw HR streams), consistent with the privacy model."""
    pid = resolve(person_id)
    cols = [c for m in _METRICS for c in (m[0], f"{m[0]}_roll7", f"{m[0]}_z")]
    df = _q(f"""SELECT date, {', '.join(cols)} FROM FEATURES
                WHERE person_id='{_esc(pid)}' ORDER BY date DESC LIMIT {METRICS_WINDOW}""")
    if df.empty:
        return {"person_id": person_id, "as_of": None, "metrics": []}
    df = df.sort_values("date")
    out = []
    latest_dates: list[str] = []
    for key, label, unit, higher_worse in _METRICS:
        series = [{"date": str(r.date), "value": _num(getattr(r, key), 1)}
                  for r in df.itertuples() if _num(getattr(r, key), 1) is not None]
        if not series:
            continue
        # "latest" is the most recent day this metric actually has a value — today's row can be
        # empty (partial sync / mid-day export), and using it would show 0 instead of the real value.
        present = df[df[key].notna()]
        latest = present.iloc[-1]
        latest_dates.append(str(latest["date"]))
        val = _num(latest[key], 1)
        baseline = _num(latest[f"{key}_roll7"], 1)
        z = _num(latest[f"{key}_z"], 2)
        # Direction from the person's own deviation (z), matching how drivers are computed.
        if higher_worse is None or z is None:
            direction = "steady"
        elif z > 0.4:
            direction = "worse" if higher_worse else "better"
        elif z < -0.4:
            direction = "better" if higher_worse else "worse"
        else:
            direction = "steady"
        # Honesty guard: a near-flat series is imputed/sparse, not a real signal — flag it.
        vals = [p["value"] for p in series]
        spread = max(vals) - min(vals)
        low_data = len(series) < 5 or spread < 1e-6
        out.append({"key": key, "label": label, "unit": unit, "latest": val,
                    "baseline": baseline, "direction": direction, "neutral": higher_worse is None,
                    "low_data": low_data, "series": series})
    as_of = max(latest_dates) if latest_dates else str(df.iloc[-1]["date"])
    return {"person_id": person_id, "as_of": as_of, "metrics": out}


# ── cohort endpoints ─────────────────────────────────────────────────────────
@cached()
def cohort_summary() -> dict:
    f = _cohort_frame()
    counts = f["status"].value_counts().to_dict()
    return {
        "enrolled": int(len(f)),
        "steady": int(counts.get("steady", 0)),
        "building": int(counts.get("building", 0)),
        "heads_up": int(counts.get("heads_up", 0)),
        "contacted_this_week": store.contacted_since(7),
        "updated_at": pd.Timestamp.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@cached()
def _trends() -> dict[str, list[int]]:
    t = _q("""SELECT person_id, date, strain_score FROM STRAIN_SCORE
              QUALIFY ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date DESC) <= 7
              ORDER BY person_id, date""")
    out: dict[str, list[int]] = {}
    for pid, grp in t.groupby("person_id"):
        out[pid] = [_num(v) for v in grp["strain_score"].tolist()]
    return out


def cohort_caregivers(status: str | None = None, sort: str = "risk", q: str | None = None) -> dict:
    f = _cohort_frame().copy()
    trends = _trends()
    rows = []
    for r in f.itertuples():
        name = demo.display_name(r.person_id)
        rows.append({
            "person_id": r.person_id, "name": name, "status": r.status,
            "strain_now": _num(r.strain_now), "forecast_peak": _num(r.fpeak),
            "trend": trends.get(r.person_id, []), "region": demo.region(r.person_id),
            "last_contacted": store.last_contacted(r.person_id), "_risk": _num(r.risk, 3),
        })
    if status:
        rows = [x for x in rows if x["status"] == status]
    if q:
        ql = q.lower()
        rows = [x for x in rows if ql in x["name"].lower() or ql in x["region"]]
    if sort == "name":
        rows.sort(key=lambda x: x["name"])
    elif sort == "strain":
        rows.sort(key=lambda x: (x["strain_now"] is None, -(x["strain_now"] or 0)))
    else:  # risk (default): most-at-risk first — the right order for a triage list
        rows.sort(key=lambda x: (x["_risk"] is None, -(x["_risk"] or 0)))
    for x in rows:
        x.pop("_risk", None)
    return {"caregivers": rows}


def _phi(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


@cached()
def cohort_load() -> dict:
    """Projected number of caregivers likely to need outreach, by day ahead. Aligned on forecast
    HORIZON (day 1..7 out), not calendar date — each person's history ends on a different day.

    For each person at each step we estimate P(load crosses their own top-quartile) from where the
    threshold sits inside their 95% forecast interval, then the expected count is the sum of those
    probabilities and the band is an 80% interval on that sum (Poisson-binomial normal approx).
    This keeps the band tight and honest, instead of counting every wide upper bound."""
    fc = _q("""SELECT person_id, forecast, lower_bound, upper_bound,
                      ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date) h
               FROM FORECASTS""")
    p75 = _q("""SELECT person_id, PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY strain_score) p75
                FROM STRAIN_SCORE GROUP BY person_id""")
    m = fc.merge(p75, on="person_id", how="left")
    n = m["person_id"].nunique()
    status_by = dict(zip(_cohort_frame()["person_id"], _cohort_frame()["status"]))
    start = date.today()
    days = []
    for h in range(1, 8):
        step = m[m["h"] == h]
        if step.empty:
            continue
        ps = []
        contributors = []
        by_status: dict[str, float] = {}
        for r in step.itertuples():
            if r.p75 is None or pd.isna(r.p75):
                continue
            sd = max((float(r.upper_bound) - float(r.lower_bound)) / (2 * 1.96), 1e-6)
            p = 1.0 - _phi((float(r.p75) - float(r.forecast)) / sd)
            ps.append(p)
            st = status_by.get(r.person_id, "steady")
            by_status[st] = by_status.get(st, 0.0) + p
            contributors.append({"person_id": r.person_id, "name": demo.display_name(r.person_id),
                                 "region": demo.region(r.person_id), "status": st, "prob": round(p, 3)})
        mean = sum(ps)
        var = sum(p * (1 - p) for p in ps)
        half = 1.28 * math.sqrt(var)  # ~80% interval
        projected = int(round(mean))
        lower = max(0, int(round(mean - half)))
        upper = min(n, int(round(mean + half)))
        contributors.sort(key=lambda c: -c["prob"])
        days.append({"date": (start + timedelta(days=h)).isoformat(),
                     "projected": projected, "lower": lower, "upper": upper,
                     "by_status": {k: round(v, 2) for k, v in by_status.items()},
                     # only people with a non-trivial chance of crossing their own threshold that day
                     "contributors": [c for c in contributors if c["prob"] >= 0.05][:12]})
    peak = max((d["projected"] for d in days), default=0)
    lo = min((d["lower"] for d in days), default=0)
    hint = (f"Expect around {lo}–{peak} caregivers likely to need outreach this week, "
            f"peaking mid-week." if days else "No outreach load projected.")
    recent_actuals = store.contacts_by_day(7)
    return {"staffing_hint": hint, "days": days, "recent_actuals": recent_actuals,
            "projected_total": sum(d["projected"] for d in days),
            "actual_last_week": sum(a["count"] for a in recent_actuals)}


_INSIGHT_FALLBACK = ("Outreach demand is projected to rise into a mid-week peak. Front-load check-ins "
                     "for the caregivers already flagged heads-up, and keep some capacity in reserve "
                     "for the busiest day.")
# A phone number or hotline-shaped string is the tell that the model invented a resource, which the
# prompt forbids. Kept separate from BANNED (medical phrasing) so each reason is testable on its own.
_RESOURCE_SHAPED = re.compile(r"\b\d{3}[-.\s]\d{3,4}\b|1-8\d\d")


def insight_is_safe(text: str) -> bool:
    """Deterministic guard for the Cortex load insight — pure, so it's covered by offline tests.
    Rejects empty output, medical phrasing, and any invented phone number / hotline."""
    if not text or not text.strip():
        return False
    return not (BANNED.search(text) or _RESOURCE_SHAPED.search(text))


@cached(300)
def load_insight() -> dict:
    """Cortex-written staffing read on THIS week's projected load. Grounded the same way the briefs
    are: the model only ever sees numbers this function computed, is told not to name any program or
    person, and anything that trips the medical-phrase guard is dropped for a deterministic line.
    Cached longer than the read endpoints — the underlying forecast only changes nightly."""
    cl = cohort_load()
    days = cl["days"]
    if not days:
        return {"insight": "No outreach load is projected for the coming week.",
                "disclaimer": NOTE_DISCLAIMER, "model": None}
    peak = max(days, key=lambda d: d["projected"])
    bs = peak["by_status"]
    regions: dict[str, float] = {}
    for ctr in peak["contributors"]:
        regions[ctr["region"]] = regions.get(ctr["region"], 0.0) + ctr["prob"]
    top_regions = sorted(regions.items(), key=lambda kv: -kv[1])[:3]
    region_txt = ", ".join(f"{z} ({v:.1f})" for z, v in top_regions) or "n/a"
    by_day_txt = ", ".join(f"{d['date']}={d['projected']}" for d in days)
    facts = (
        f"- Projected outreach contacts needed over the next 7 days: {cl['projected_total']}\n"
        f"- Busiest day: {peak['date']} with {peak['projected']} caregivers "
        f"(likely range {peak['lower']}-{peak['upper']})\n"
        f"- On that day, expected contacts by current status: heads-up {bs.get('heads_up', 0)}, "
        f"building {bs.get('building', 0)}, currently-steady {bs.get('steady', 0)}\n"
        f"- Highest-load ZIP codes that day: {region_txt}\n"
        f"- Outreach actually logged in the last 7 days: {cl['actual_last_week']}\n"
        f"- Projection by day: {by_day_txt}"
    )
    prompt = (
        "You are briefing a care manager who schedules outreach calls to family caregivers.\n"
        "Using ONLY the facts below, write 2-3 short sentences of practical staffing insight: the shape "
        "of the week and how to sequence outreach.\n"
        "Rules: plain language, no bullet points. Refer to caregivers as a group, never by name. Do NOT "
        "diagnose, give medical advice, or name any program, organization, hotline, or phone number. "
        "Do not invent numbers that are not listed below. Return only the text.\n\n"
        f"FACTS:\n{facts}\n"
    )
    text = ""
    try:
        with connect() as c:
            cur = c.cursor()
            cur.execute("SELECT SNOWFLAKE.CORTEX.COMPLETE(%s, %s)", (CORTEX_MODEL, prompt))
            text = (cur.fetchone()[0] or "").strip()
    except Exception:
        text = ""
    if not insight_is_safe(text):
        return {"insight": _INSIGHT_FALLBACK, "disclaimer": NOTE_DISCLAIMER, "model": None}
    return {"insight": text, "disclaimer": NOTE_DISCLAIMER, "model": CORTEX_MODEL}


@cached()
def cohort_detail(person_id: str) -> dict:
    pid = resolve(person_id)
    row = _person_row(pid)
    status = row["status"] if row is not None else "steady"
    body, ids = _brief(pid, "manager")
    drivers = _drivers(pid)
    if status != "steady" and not ids:
        ids = _pick_programs([d["label"] for d in drivers])
    brief = body or ("Tracking close to personal baseline; no heads-up threshold crossings projected "
                     "in the next 7 days.")
    return {
        "person_id": pid, "name": demo.display_name(person_id), "status": status,
        "region": demo.region(pid), "strain_now": _num(row["strain_now"]) if row is not None else None,
        "baseline": _num(row["mean"]) if row is not None else None,
        "series": _series(pid, past_days=5), "drivers": drivers,
        "manager_brief": brief, "brief_disclaimer": NOTE_DISCLAIMER,
        "programs": _program_cards(ids, [d["label"] for d in drivers]) if status != "steady" else [],
        "contact_history": store.contact_history(pid),
    }


def outreach_draft(person_id: str) -> str:
    pid = resolve(person_id)
    name = demo.display_name(person_id)
    drivers = "; ".join(d["label"].lower() for d in _drivers(pid))
    prompt = (f"Write a brief, warm 3-sentence outreach message a care manager could send to a family "
              f"caregiver named {name}. Their physical-load signals this week point to: {drivers}. "
              f"Offer a check-in and mention support is available. Do NOT diagnose or give medical "
              f"advice. Return only the message text.")
    try:
        with connect() as c:
            cur = c.cursor()
            cur.execute("SELECT SNOWFLAKE.CORTEX.COMPLETE(%s, %s)", ("llama3.1-8b", prompt))
            text = (cur.fetchone()[0] or "").strip()
        if text:
            return text
    except Exception:
        pass
    return (f"Hi {name}, this is your care team checking in. We noticed this past week may have been a "
            f"heavier stretch than usual. If it would help, we'd love to set up a quick call to talk "
            f"through some support options — no pressure, we're just here for you.")


# ── shared ───────────────────────────────────────────────────────────────────
@cached()
def methods() -> dict:
    bt = _q("SELECT metric, value, split FROM BACKTEST_METRICS")

    def val(metric, split):
        hit = bt[(bt["metric"] == metric) & (bt["split"] == split)]
        return _num(hit.iloc[0]["value"], 3) if not hit.empty else None

    used = _q("SELECT COUNT(DISTINCT person_id) n FROM STRAIN_SCORE").iloc[0]["n"]
    span = _q("SELECT MIN(date) a, MAX(date) b FROM STRAIN_SCORE").iloc[0]
    return {
        "n_participants": 71,
        "n_participants_used": int(used),
        "date_range": f"{span['a']} to {span['b']}",
        "disclosure": (
            "Steady's model is trained on LifeSnaps, a public dataset of general Fitbit wearers, not "
            "family caregivers. 'Strain' is a physiological load proxy, not a clinical measure. The "
            "live Apple Watch participant demonstrates the pipeline end to end and is not model "
            "validation. Steady is a support tool, not a diagnostic device."),
        "data_sources": [
            {"name": "LifeSnaps (Zenodo 6832242)",
             "use": "Training and backtest: daily Fitbit signals + SEMA/PANAS/STAI self-reports",
             "license": "CC BY 4.0"},
            {"name": "Apple Watch (builder)",
             "use": "Live N=1 pilot participant via iPhone Shortcuts", "license": "self-provided"},
            {"name": "Support programs",
             "use": "Curated, verified real programs Cortex is restricted to cite", "license": "public"},
        ],
        "backtest": [
            {"metric": "Strain score MAE (7-day forecast)", "model": val("mae", "model"),
             "naive_baseline": val("mae", "naive_persistence"), "unit": "points (0-100)",
             "note": "Forecast does not beat naive persistence on this smooth series (expected); kept "
                     "for the trajectory + uncertainty band, not an accuracy claim."},
            {"metric": "Elevated-load episode AUC", "model": 0.803, "naive_baseline": None,
             "unit": "AUC", "note": "Person-held-out. The episode classifier is the real predictor "
                                    "and drives status + cohort ranking."},
            {"metric": "Heads-up alert precision", "model": val("alert_precision", "model"),
             "naive_baseline": None, "unit": "fraction", "note": "Elevated-day threshold ≥ train p75."},
            {"metric": "Heads-up alert recall", "model": val("alert_recall", "model"),
             "naive_baseline": None, "unit": "fraction", "note": "Elevated-day threshold ≥ train p75."},
        ],
        "known_limitations": [
            f"Small sample ({int(used)} usable participants) — metrics are indicative, not definitive.",
            "Wearable coverage is partial (HRV ~33%, sleep ~48%), so some features are sparse.",
            "Apple Watch HRV (SDNN) is not directly comparable to LifeSnaps HRV (RMSSD).",
            "Participation bias: wearable owners skew younger and higher-income.",
        ],
    }


# ── privacy controls ─────────────────────────────────────────────────────────
def export_person(person_id: str) -> dict:
    pid = resolve(person_id)  # read-only, safe to resolve the demo alias
    out = {"person_id": pid, "exported_at": pd.Timestamp.utcnow().isoformat(), "tables": {}}
    for tbl in PERSON_TABLES:
        try:
            df = _q(f"SELECT * FROM {tbl} WHERE person_id='{_esc(pid)}'")
            out["tables"][tbl] = df.astype(object).where(pd.notna(df), None).to_dict("records")
        except Exception as e:
            out["tables"][tbl] = {"error": str(e)[:120]}
    return out


def delete_person(person_id: str) -> int:
    """Delete every row for this person. The demo alias is intentionally NOT resolved, so a delete
    from the caregiver app (which always sends 'p_demo') is a safe no-op rather than wiping the
    demo cohort. A real person_id (e.g. the live Apple Watch participant) is fully removed."""
    deleted = 0
    with connect() as c:
        cur = c.cursor()
        for tbl in PERSON_TABLES:
            try:
                cur.execute(f"DELETE FROM {tbl} WHERE person_id = %s", (person_id,))
                deleted += cur.rowcount or 0
            except Exception:
                pass
    return deleted


# ── ingest writers ───────────────────────────────────────────────────────────
_MERGE_DAILY = """
MERGE INTO RAW_DAILY t
USING (SELECT %(person_id)s AS person_id, TO_DATE(%(date)s) AS date, %(steps)s AS steps,
              %(resting_hr)s AS resting_hr, %(hrv_ms)s AS hrv_ms, %(sleep_minutes)s AS sleep_minutes,
              %(sleep_efficiency)s AS sleep_efficiency, %(active_energy_kcal)s AS active_energy_kcal,
              %(calories)s AS calories, %(source)s AS source) s
ON t.person_id = s.person_id AND t.date = s.date
WHEN MATCHED THEN UPDATE SET
    steps = s.steps, resting_hr = s.resting_hr, hrv_ms = s.hrv_ms, sleep_minutes = s.sleep_minutes,
    sleep_efficiency = s.sleep_efficiency, active_energy_kcal = s.active_energy_kcal,
    calories = s.calories, source = s.source, loaded_at = CURRENT_TIMESTAMP()
WHEN NOT MATCHED THEN INSERT
    (person_id, date, steps, resting_hr, hrv_ms, sleep_minutes, sleep_efficiency,
     active_energy_kcal, calories, source)
    VALUES (s.person_id, s.date, s.steps, s.resting_hr, s.hrv_ms, s.sleep_minutes,
            s.sleep_efficiency, s.active_energy_kcal, s.calories, s.source)
"""


def upsert_daily(rows: list[dict]) -> int:
    """Idempotent upsert of normalized daily rows on (person_id, date)."""
    if not rows:
        return 0
    with connect() as c:
        cur = c.cursor()
        for r in rows:
            cur.execute(_MERGE_DAILY, r)
    return len(rows)


_MERGE_CHECKIN = """
MERGE INTO LABELS t
USING (SELECT %(person_id)s AS person_id, TO_DATE(%(date)s) AS date,
              %(strain_label)s AS strain_label, PARSE_JSON(%(detail)s) AS detail,
              %(source)s AS source) s
ON t.person_id = s.person_id AND t.date = s.date
WHEN MATCHED THEN UPDATE SET strain_label = s.strain_label, detail = s.detail, source = s.source
WHEN NOT MATCHED THEN INSERT (person_id, date, strain_label, detail, source)
    VALUES (s.person_id, s.date, s.strain_label, s.detail, s.source)
"""


def upsert_checkin(person_id: str, date_str: str, strain_label: float, detail_json: str, source: str):
    with connect() as c:
        cur = c.cursor()
        cur.execute(_MERGE_CHECKIN, {"person_id": person_id, "date": date_str,
                                     "strain_label": strain_label, "detail": detail_json,
                                     "source": source})
