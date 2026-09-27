"""App workflow state that isn't model output: program feedback and care-manager contact history.

Kept in a local SQLite file, not Snowflake — it's per-demo UI state (who was marked contacted,
which program was flagged helpful), written on button clicks and read back into the cohort views.
"""
import sqlite3
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone

from server.config import DB_PATH


@contextmanager
def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS feedback (
            person_id TEXT, program_id TEXT, helpful INTEGER, created_at TEXT)""")
        c.execute("""CREATE TABLE IF NOT EXISTS contacts (
            person_id TEXT, at TEXT, by_role TEXT, note TEXT)""")


def add_feedback(person_id: str, program_id: str, helpful: bool):
    with _conn() as c:
        c.execute("INSERT INTO feedback VALUES (?,?,?,?)",
                  (person_id, program_id, int(helpful), datetime.now(timezone.utc).isoformat()))


def mark_contacted(person_id: str, note: str = "Outreach logged.", by_role: str = "care_manager"):
    with _conn() as c:
        c.execute("INSERT INTO contacts VALUES (?,?,?,?)",
                  (person_id, date.today().isoformat(), by_role, note))


def contact_history(person_id: str) -> list[dict]:
    with _conn() as c:
        rows = c.execute(
            "SELECT at, by_role, note FROM contacts WHERE person_id=? ORDER BY at", (person_id,)
        ).fetchall()
    return [{"date": r["at"], "by": r["by_role"], "note": r["note"]} for r in rows]


def last_contacted(person_id: str) -> str | None:
    with _conn() as c:
        row = c.execute(
            "SELECT MAX(at) m FROM contacts WHERE person_id=?", (person_id,)
        ).fetchone()
    return row["m"] if row and row["m"] else None


def contacted_since(days: int = 7) -> int:
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    with _conn() as c:
        row = c.execute(
            "SELECT COUNT(DISTINCT person_id) n FROM contacts WHERE at >= ?", (cutoff,)
        ).fetchone()
    return row["n"] if row else 0


def contacts_by_day(days: int = 7) -> list[dict]:
    """Actual outreach volume per day for the last `days` days (distinct people contacted each day),
    for the care-manager 'actuals vs projected' overlay. Zero-filled so every day appears."""
    start = date.today() - timedelta(days=days - 1)
    with _conn() as c:
        rows = c.execute(
            "SELECT at, COUNT(DISTINCT person_id) n FROM contacts WHERE at >= ? GROUP BY at",
            (start.isoformat(),),
        ).fetchall()
    counts = {r["at"]: r["n"] for r in rows}
    return [{"date": (start + timedelta(days=i)).isoformat(), "count": counts.get((start + timedelta(days=i)).isoformat(), 0)}
            for i in range(days)]


def seed_demo_contacts(person_ids: list[str]):
    """One-time: give the caseload a little contact history so the dashboard isn't blank in the demo.
    Clearly synthetic workflow state, not clinical data. No-op if any contacts already exist."""
    with _conn() as c:
        if c.execute("SELECT COUNT(*) n FROM contacts").fetchone()["n"] > 0:
            return
    today = date.today()
    for i, pid in enumerate(person_ids):
        when = (today - timedelta(days=[2, 4, 5, 3, 6][i % 5])).isoformat()
        with _conn() as c:
            c.execute("INSERT INTO contacts VALUES (?,?,?,?)",
                      (pid, when, "care_manager", "Check-in call logged."))
