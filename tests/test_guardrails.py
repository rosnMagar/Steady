"""Guardrail tests for the Cortex layer. These test our deterministic validation code,
NOT the LLM — so they're fast, offline, and reliable.
"""
from src.briefs import validate_output, CRISIS_NOTE, BANNED

VALID = {"eldercare_locator", "can_helpdesk", "arch_respite", "fca"}


def test_invented_program_is_dropped():
    out = validate_output({"note": "n", "program_ids": ["can_helpdesk", "totally_made_up"]}, VALID)
    assert out["program_ids"] == ["can_helpdesk"]
    assert out["dropped_invented"] == ["totally_made_up"]


def test_only_valid_programs_survive():
    out = validate_output({"note": "n", "program_ids": ["fake1", "fake2"]}, VALID)
    assert out["program_ids"] == []
    assert set(out["dropped_invented"]) == {"fake1", "fake2"}


def test_at_most_two_programs():
    out = validate_output(
        {"note": "n", "program_ids": ["eldercare_locator", "can_helpdesk", "arch_respite"]}, VALID)
    assert len(out["program_ids"]) == 2


def test_medical_phrasing_flagged():
    assert validate_output({"note": "You have a heart disorder."}, VALID)["flagged_medical"]
    assert validate_output({"note": "I will diagnose your condition."}, VALID)["flagged_medical"]
    assert validate_output({"note": "Adjust your medication dose."}, VALID)["flagged_medical"]


def test_supportive_note_not_flagged():
    out = validate_output(
        {"note": "You've had a demanding week and your sleep is down. Consider reaching out for support."},
        VALID)
    assert not out["flagged_medical"]


def test_crisis_note_constant_present():
    assert "988" in CRISIS_NOTE


def test_banned_regex_matches_diagnosis_words():
    assert BANNED.search("diagnosis")
    assert not BANNED.search("your sleep has been shorter than usual")


# ── care-manager load insight (Cortex) ───────────────────────────────────────
from server.repo import insight_is_safe


def test_insight_rejects_empty_output():
    assert not insight_is_safe("")
    assert not insight_is_safe("   ")


def test_insight_rejects_invented_phone_number():
    assert not insight_is_safe("Call the caregiver support line at 555-0134 to coordinate.")
    assert not insight_is_safe("Refer them to 1-800-555-1212 for help.")


def test_insight_rejects_medical_phrasing():
    assert not insight_is_safe("These caregivers have a stress disorder this week.")


def test_real_staffing_insight_passes():
    assert insight_is_safe(
        "The week builds toward a mid-week peak of 13 caregivers on October 2nd. Front-load "
        "check-ins earlier in the week and hold capacity for the busiest day."
    )


def test_insight_allows_zips_dates_and_ranges():
    """ZIP codes, ISO dates and numeric ranges must not trip the phone-number guard."""
    assert insight_is_safe("Load concentrates in 63109, 63118 and 63110 on 2026-10-02.")
    assert insight_is_safe("Expect 11-12 contacts per day, peaking at 13.")
