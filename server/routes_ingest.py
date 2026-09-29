"""Ingest routes (from iPhone Shortcuts). Bearer-token protected; normalize on receipt so RAW_DAILY
stays clean and upserts are idempotent on (person_id, date).

After a successful `apple_watch` ingest we schedule `src.score_live` on a FastAPI BackgroundTask
so the phone's POST returns fast and the caregiver's status/forecast are refreshed within a few
seconds — no waiting for the nightly Snowflake Task. Only apple_watch rows trigger it; the demo
cohort (LifeSnaps) is pre-scored and doesn't need per-ingest rework."""
import json
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from server import repo
from server.auth import require_ingest_token
from server.cache import clear as clear_read_cache
from server.normalize import normalize_daily, parse_local_date, sleep_metrics, NormalizationError
from server.schemas import DailyRaw, BackfillBody, Checkin

router = APIRouter(prefix="/ingest", tags=["ingest"], dependencies=[Depends(require_ingest_token)])
_log = logging.getLogger(__name__)


def _trigger_live_rescore(person_id: str) -> None:
    """Rebuild FEATURES/STRAIN_SCORE for this live person, re-forecast their series, and rewrite
    RISK+ALERTS — the Python step the nightly SQL Task cannot do on its own. Then invalidate the
    read cache so the next dashboard fetch sees the new state. Errors are logged, never raised:
    a downstream refresh must never fail an ingest, and the nightly Task is still a backstop."""
    try:
        from src.score_live import run as _score_live
        result = _score_live([person_id])
        _log.info("live rescore for %s: %s", person_id, result)
        clear_read_cache()
    except Exception:  # noqa: BLE001 — background boundary; log and swallow
        _log.exception("live rescore failed for %s", person_id)


@router.post("/daily")
def ingest_daily(payload: DailyRaw, background: BackgroundTasks):
    body = payload.model_dump()
    try:
        row = normalize_daily(body)
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    repo.upsert_daily([row])
    if row.get("source") == "apple_watch":
        background.add_task(_trigger_live_rescore, row["person_id"])
    # Echo what the sleep parser actually made of the payload. A null sleep value used to be
    # indistinguishable from "nothing was sent"; now the Shortcut's response says which it was,
    # and names any stage label we didn't recognise.
    m = sleep_metrics(body.get("sleep_raw"))
    return {
        "ok": True, "person_id": row["person_id"], "date": row["date"],
        "sleep": {
            "minutes": row["sleep_minutes"], "efficiency": row["sleep_efficiency"],
            "intervals_received": m["intervals"], "intervals_used": m["recognized"],
            "unrecognized_values": m["unrecognized"],
        },
    }


@router.post("/backfill")
def ingest_backfill(body: BackfillBody, background: BackgroundTasks):
    try:
        rows = [normalize_daily(d.model_dump()) for d in body.days]
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    repo.upsert_daily(rows)
    # One rescore per unique apple_watch person_id — not one per day. score_live rebuilds the
    # whole series each call, so batching a 30-day backfill into one background task is right.
    scheduled: set[str] = set()
    for r in rows:
        if r.get("source") == "apple_watch" and r["person_id"] not in scheduled:
            background.add_task(_trigger_live_rescore, r["person_id"])
            scheduled.add(r["person_id"])
    return {"ok": True, "count": len(rows)}


@router.post("/checkin")
def ingest_checkin(c: Checkin):
    # Normalize the date the same way the daily route does, instead of passing the string straight
    # through: an unvalidated date let a future-dated check-in land, joining to no wearable day.
    try:
        d = parse_local_date(c.date)
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    # Map the 1-5 self-report onto the same 0-100 scale as the strain target; keep raw parts in detail.
    strain_label = round((c.stress - 1) / 4 * 100, 1)
    detail = json.dumps({"stress_1_5": c.stress, "tags": c.tags})
    repo.upsert_checkin(c.person_id, d.isoformat(), strain_label, detail, c.source)
    return {"ok": True, "date": d.isoformat()}
