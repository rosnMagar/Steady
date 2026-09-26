"""Snowflake data-integrity invariants. Skips cleanly if no connection/.env is available,
so `pytest` still runs offline (leakage + guardrail tests don't need Snowflake).
"""
import pytest

try:
    from src.snowflake_io import query
    query("SELECT 1")
    HAVE_SF = True
except Exception:
    HAVE_SF = False

pytestmark = pytest.mark.skipif(not HAVE_SF, reason="no Snowflake connection")


def test_risk_in_unit_interval():
    bad = query("SELECT COUNT(*) n FROM RISK WHERE risk < 0 OR risk > 1").iloc[0, 0]
    assert bad == 0


def test_forecast_intervals_ordered():
    bad = query("SELECT COUNT(*) n FROM FORECASTS WHERE NOT (lower_bound <= forecast AND forecast <= upper_bound)").iloc[0, 0]
    assert bad == 0


def test_alert_status_valid():
    bad = query("SELECT COUNT(*) n FROM ALERTS WHERE status NOT IN ('steady','building','heads_up')").iloc[0, 0]
    assert bad == 0


def test_briefs_only_cite_real_programs():
    # every id in BRIEFS.program_ids must exist in PROGRAMS (grounding invariant)
    orphan = query("""
        SELECT COUNT(*) n FROM BRIEFS b, LATERAL FLATTEN(input => b.program_ids) f
        WHERE f.value::string NOT IN (SELECT program_id FROM PROGRAMS)
    """).iloc[0, 0]
    assert orphan == 0


def test_strain_score_populated():
    n = query("SELECT COUNT(*) n FROM STRAIN_SCORE").iloc[0, 0]
    assert n > 0
