"""Caregiver app read routes + privacy controls."""
from fastapi import APIRouter

from server import repo, store
from server.schemas import Feedback

router = APIRouter(prefix="/api/caregivers", tags=["caregiver"])


@router.get("/{person_id}/today")
def get_today(person_id: str):
    return repo.today(person_id)


@router.get("/{person_id}/headsup")
def get_headsup(person_id: str):
    return repo.headsup(person_id)


@router.get("/{person_id}/insight")
def get_insight(person_id: str):
    """Cortex read of this person's own 7-day chart, shown under it on the Today screen."""
    return repo.today_insight(person_id)


@router.get("/{person_id}/metrics")
def get_metrics(person_id: str):
    """Recent daily wearable signals with personal baselines — the data behind the status.
    Used by both the caregiver app and the care-manager drawer."""
    return repo.metrics(person_id)


@router.post("/{person_id}/feedback")
def post_feedback(person_id: str, fb: Feedback):
    store.add_feedback(person_id, fb.program_id, fb.helpful)
    return {"ok": True}


@router.get("/{person_id}/export")
def get_export(person_id: str):
    return repo.export_person(person_id)


@router.delete("/{person_id}/data")
def delete_data(person_id: str):
    return {"ok": True, "deleted": repo.delete_person(person_id)}
