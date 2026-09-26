"""Ingest routes (from iPhone Shortcuts). Bearer-token protected; normalize on receipt so RAW_DAILY
stays clean and upserts are idempotent on (person_id, date)."""
import json

from fastapi import APIRouter, Depends, HTTPException

from server import repo
from server.auth import require_ingest_token
from server.normalize import normalize_daily, NormalizationError
from server.schemas import DailyRaw, BackfillBody, Checkin

router = APIRouter(prefix="/ingest", tags=["ingest"], dependencies=[Depends(require_ingest_token)])


@router.post("/daily")
def ingest_daily(payload: DailyRaw):
    try:
        row = normalize_daily(payload.model_dump())
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))
    repo.upsert_daily([row])
    return {"ok": True, "person_id": row["person_id"], "date": row["date"]}


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
    # Map the 1-5 self-report onto the same 0-100 scale as the strain target; keep raw parts in detail.
    strain_label = round((c.stress - 1) / 4 * 100, 1)
    detail = json.dumps({"stress_1_5": c.stress, "tags": c.tags})
    repo.upsert_checkin(c.person_id, c.date, strain_label, detail, c.source)
    return {"ok": True}
