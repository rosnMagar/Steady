"""Care-manager dashboard routes."""
from fastapi import APIRouter

from server import repo, store

router = APIRouter(prefix="/api/cohort", tags=["cohort"])


@router.get("/summary")
def summary():
    return repo.cohort_summary()


@router.get("/caregivers")
def caregivers(status: str | None = None, sort: str = "risk", q: str | None = None):
    return repo.cohort_caregivers(status=status, sort=sort, q=q)


@router.get("/load-forecast")
def load_forecast():
    return repo.cohort_load()


@router.get("/caregivers/{person_id}")
def detail(person_id: str):
    return repo.cohort_detail(person_id)


@router.post("/caregivers/{person_id}/contacted")
def contacted(person_id: str):
    store.mark_contacted(person_id)
    return {"ok": True}


@router.post("/caregivers/{person_id}/outreach-draft")
def outreach_draft(person_id: str):
    return {"draft": repo.outreach_draft(person_id)}
