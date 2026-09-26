"""LLM behavioral eval: run Cortex over a sample of people and measure a PASS RATE on properties
we require. This is how we put a number on LLM reliability (the guardrails guarantee safety; this
measures quality). Kept as a script (not pytest) because it makes real, billable Cortex calls.

Run: .venv/bin/python -m src.eval_llm
"""
from src.briefs import generate, select_programs, BANNED, _drivers_for
from src.snowflake_io import query


def check(b: dict) -> dict:
    note = b["note"]
    prog_names = query(
        "SELECT name FROM PROGRAMS WHERE program_id IN (%s)"
        % ",".join(f"'{p}'" for p in b["program_ids"]) if b["program_ids"] else "SELECT name FROM PROGRAMS WHERE 1=0"
    )["NAME"].tolist() if b["program_ids"] else []
    return {
        "valid_json_nonempty": bool(note) and len(note) > 20,
        "grounded_no_invented": b["_dropped_invented"] == [],
        "no_medical_phrase": not b["_flagged_medical"],
        "reasonable_length": 20 <= len(note) <= 600,
        "mentions_a_program": any(n.split()[0].lower() in note.lower() for n in prog_names) if prog_names else False,
    }


def run(n: int = 8):
    people = query("SELECT person_id, status FROM ALERTS WHERE status <> 'steady' LIMIT %d" % n)
    checks = []
    for r in people.itertuples():
        b = generate(r.PERSON_ID, r.STATUS)
        c = check(b)
        checks.append(c)
        print(f"  {r.PERSON_ID[:10]} {'✓' if all(c.values()) else '✗'} "
              + " ".join(k for k, v in c.items() if not v) or "all pass")
    if not checks:
        print("no non-steady people to eval"); return
    keys = checks[0].keys()
    print(f"\n=== LLM EVAL over {len(checks)} briefs ===")
    for k in keys:
        rate = sum(c[k] for c in checks) / len(checks)
        print(f"  {k:24s} {rate*100:5.0f}% pass")
    overall = sum(all(c.values()) for c in checks) / len(checks)
    print(f"  {'ALL-PROPERTIES':24s} {overall*100:5.0f}% pass")


if __name__ == "__main__":
    run()
