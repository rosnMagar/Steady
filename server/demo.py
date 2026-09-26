"""Presentation-only helpers: deterministic display names and region labels derived from the
pseudonymous person_id (the tables store no names or regions), plus the demo-person alias.

None of this is model output. It exists so a caseload of hashed ids reads like a caseload of
people in the demo, without inventing any clinical facts.
"""
import hashlib

# The caregiver app is hard-wired to "p_demo" (web/src/pages/caregiver/*). We resolve that alias
# to the single highest-risk real person so Today, Heads-up and the cohort drawer all tell one story.
DEMO_ALIAS = "p_demo"
DEMO_NAME = "Maria R."

_FIRST = [
    "Maria", "James", "Aisha", "Robert", "Linda", "Chen", "Deja", "Sofia", "Marcus",
    "Priya", "David", "Grace", "Hassan", "Nora", "Luis", "Emma", "Omar", "Ruth",
    "Kofi", "Ingrid", "Diego", "Yuki", "Samuel", "Fatima", "Peter", "Carmen",
]
_LAST_INITIALS = list("RTKMPWBHLSGCADNOF")
# St. Louis ZIPs, matching the region labels the UI mocks used.
_REGIONS = ["63101", "63104", "63109", "63110", "63116", "63118", "63139", "63147"]


def _h(person_id: str) -> int:
    return int(hashlib.sha1(person_id.encode()).hexdigest(), 16)


def display_name(person_id: str) -> str:
    if person_id == DEMO_ALIAS:
        return DEMO_NAME
    h = _h(person_id)
    return f"{_FIRST[h % len(_FIRST)]} {_LAST_INITIALS[(h // 7) % len(_LAST_INITIALS)]}."


def region(person_id: str) -> str:
    return _REGIONS[_h(person_id) % len(_REGIONS)]
