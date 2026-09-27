"""Bite E: Cortex-generated caregiver notes + care-manager briefs, grounded in PROGRAMS.

Guardrails (enforced in code, not trusted to the LLM):
- Cited programs MUST exist in PROGRAMS; invented ids are dropped.
- Output must not contain diagnostic / medical-advice phrasing (flagged + logged).
- A crisis (988) line is always attached.
"""
import json
import re
import pandas as pd
from src.snowflake_io import connect, query, load_dataframe

MODEL = "llama3.1-8b"  # confirmed available in the smoke test
CRISIS_NOTE = "If you are in crisis or thinking about harming yourself, call or text 988 anytime."
BANNED = re.compile(r"\b(diagnos|you have|prescrib|medication dose|disease|disorder|treat your)\w*", re.I)

PROMPT = """You support family caregivers. Using ONLY the facts given, write a short, warm note.

Rules:
- 3-4 sentences, plain language, second person ("you"). Caring, never alarming.
- Describe the caregiver's OWN physical load this week using the wearable signals below (they describe
  the caregiver, not anyone else). Do NOT diagnose or give medical advice.
- Gently point them to the TWO recommended programs below, by NAME. Do not invent any other resource
  or any phone number.
- Also write a one-sentence factual manager_brief for a care manager.
Return ONLY valid JSON: {{"note": "...", "manager_brief": "..."}}

The caregiver's status this week: {status}
Their own wearable signals this week: {drivers}

RECOMMENDED PROGRAMS (mention both by name):
{programs}
"""

# tag priorities for a caregiver-strain heads-up; program selection is deterministic (code, not LLM)
TARGET_TAGS = ["respite", "emotional_support", "navigation", "peer_support", "education"]


def _drivers_for(person_id: str) -> list[str]:
    row = query(f"""SELECT * FROM FEATURES WHERE person_id='{person_id}'
                    QUALIFY ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date DESC)=1""")
    if row.empty:
        return ["physical load is elevated versus your usual"]
    r = {k.lower(): v for k, v in row.iloc[0].items()}
    cand = []
    if r.get("resting_hr_z", 0) and r["resting_hr_z"] > 0.4:
        cand.append(("resting heart rate running above your usual", r["resting_hr_z"]))
    if r.get("minutesasleep_z", 0) and r["minutesasleep_z"] < -0.4:
        cand.append(("sleeping less than your normal", -r["minutesasleep_z"]))
    if r.get("rmssd_z", 0) and r["rmssd_z"] < -0.4:
        cand.append(("recovery signal (heart-rate variability) is down", -r["rmssd_z"]))
    if r.get("sleep_efficiency_z", 0) and r["sleep_efficiency_z"] < -0.4:
        cand.append(("sleep quality dipping below your baseline", -r["sleep_efficiency_z"]))
    cand.sort(key=lambda x: -abs(x[1]))
    return [c[0] for c in cand[:3]] or ["sustained physical load above your usual"]


def _candidate_programs() -> pd.DataFrame:
    return query("SELECT program_id, name, org, description, ARRAY_TO_STRING(tags,'|') tags FROM PROGRAMS")


def select_programs(drivers: list[str], k: int = 2) -> pd.DataFrame:
    """Deterministically pick the k most relevant programs by tag priority. Grounded by construction —
    the LLM never chooses ids, so it cannot hallucinate one. Excludes the 988 crisis line (shown separately)."""
    progs = _candidate_programs()
    progs = progs[progs["PROGRAM_ID"] != "lifeline_988"].copy()
    want = list(TARGET_TAGS)
    if any("sleep" in d for d in drivers):
        want = ["respite"] + want  # boost respite when sleep is the driver
    def score(tagstr):
        tags = tagstr.split("|")
        return sum((len(want) - want.index(t)) for t in tags if t in want)
    progs["_s"] = progs["TAGS"].apply(score)
    return progs.sort_values("_s", ascending=False).head(k)


def _extract_json(text: str) -> dict:
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0)) if m else {}


def cortex_complete(prompt: str, model: str = MODEL) -> str:
    with connect() as c:
        cur = c.cursor()
        cur.execute("SELECT SNOWFLAKE.CORTEX.COMPLETE(%s, %s)", (model, prompt))
        return cur.fetchone()[0]


def validate_output(data: dict, valid_ids: set) -> dict:
    """Deterministic guardrail: drop invented program ids, flag medical phrasing. Pure function."""
    cited = [p for p in data.get("program_ids", []) if p in valid_ids]
    dropped = [p for p in data.get("program_ids", []) if p not in valid_ids]
    note, mgr = data.get("note", "").strip(), data.get("manager_brief", "").strip()
    return {
        "note": note, "manager_brief": mgr,
        "program_ids": cited[:2], "dropped_invented": dropped,
        "flagged_medical": bool(BANNED.search(note) or BANNED.search(mgr)),
    }


def generate(person_id: str, status: str) -> dict:
    drivers = _drivers_for(person_id)
    chosen = select_programs(drivers)                       # grounded in code
    chosen_ids = chosen["PROGRAM_ID"].tolist()
    prog_txt = "\n".join(f"- {r.NAME} ({r.ORG}): {r.DESCRIPTION}" for r in chosen.itertuples())
    prompt = PROMPT.format(status=status, drivers="; ".join(drivers), programs=prog_txt)
    raw = cortex_complete(prompt)
    data = _extract_json(raw)
    data["program_ids"] = chosen_ids                        # ids come from code, never the LLM
    v = validate_output(data, set(chosen_ids))
    return {"person_id": person_id, "status": status, "crisis_note": CRISIS_NOTE,
            "_dropped_invented": v["dropped_invented"], "_flagged_medical": v["flagged_medical"],
            "_raw": raw, **v}


def generate_batch():
    """Generate + persist briefs for every non-steady person into BRIEFS."""
    people = query("SELECT person_id, date, status FROM ALERTS WHERE status <> 'steady'")
    rows = []
    for r in people.itertuples():
        b = generate(r.PERSON_ID, r.STATUS)
        pj = "|".join(b["program_ids"])
        rows.append((r.PERSON_ID, r.DATE, "caregiver", b["note"], pj, MODEL))
        rows.append((r.PERSON_ID, r.DATE, "manager", b["manager_brief"], pj, MODEL))
        print(f"  {r.PERSON_ID[:10]} {r.STATUS}: {len(b['program_ids'])} programs, "
              f"flagged={b['_flagged_medical']}, invented={b['_dropped_invented']}")
    df = pd.DataFrame(rows, columns=["person_id", "date", "audience", "body", "program_ids", "model"])
    with connect() as c:
        cur = c.cursor()
        cur.execute("TRUNCATE TABLE BRIEFS")
        cur.execute("""CREATE OR REPLACE TABLE BRIEFS_RAW (person_id STRING, date DATE, audience STRING,
                       body STRING, program_ids STRING, model STRING)""")
    load_dataframe(df, "BRIEFS_RAW")
    with connect() as c:
        cur = c.cursor()
        cur.execute("""INSERT INTO BRIEFS (person_id, date, audience, body, program_ids, model)
                       SELECT person_id, date, audience, body, STRTOK_TO_ARRAY(program_ids,'|'), model
                       FROM BRIEFS_RAW""")
        cur.execute("DROP TABLE BRIEFS_RAW")
    print(f"wrote {len(rows)} brief rows to BRIEFS")


def _preview_one():
    """Smoke test: generate + print a single brief without persisting."""
    top = query("SELECT person_id, status FROM ALERTS ORDER BY rule DESC").iloc[0]
    b = generate(top["PERSON_ID"], top["STATUS"])
    print("STATUS:", b["status"])
    print("NOTE:", b["note"])
    print("PROGRAMS:", b["program_ids"], "| dropped invented:", b["_dropped_invented"])
    print("MANAGER:", b["manager_brief"])
    print("medical-phrase flagged:", b["_flagged_medical"])


if __name__ == "__main__":
    # Default: regenerate + persist every non-steady person's brief into BRIEFS.
    #   .venv/bin/python -m src.briefs            # full batch (truncates + rebuilds BRIEFS)
    #   .venv/bin/python -m src.briefs --preview  # print one brief, write nothing
    import sys
    if "--preview" in sys.argv:
        _preview_one()
    else:
        generate_batch()
