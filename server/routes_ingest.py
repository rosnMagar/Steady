"""Ingest routes (from iPhone Shortcuts). Bearer-token protected; normalize on receipt so RAW_DAILY
stays clean and upserts are idempotent on (person_id, date)."""
import json

from fastapi import APIRouter, Depends, HTTPException

from server import repo
from server.auth import require_ingest_token
from server.normalize import normalize_daily, parse_local_date, sleep_metrics, NormalizationError
from server.schemas import DailyRaw, BackfillBody, Checkin

router = APIRouter(prefix="/ingest", tags=["ingest"], dependencies=[Depends(require_ingest_token)])


@router.post("/daily")
def ingest_daily(payload: DailyRaw):
    body = payload.model_dump()
    try:
        row = normalize_daily(body)
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    repo.upsert_daily([row])
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
def ingest_backfill(body: BackfillBody):
    try:
        rows = [normalize_daily(d.model_dump()) for d in body.days]
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    repo.upsert_daily(rows)
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
