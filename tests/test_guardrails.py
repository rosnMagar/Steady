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
