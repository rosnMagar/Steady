# PROGRESS — Steady (TigerHacks 2026)

Caregiver physical-load forecasting. Wearables → load index → Snowflake ML → Cortex briefs → React app.
Honest, non-diagnostic. Sponsor: Snowflake (ML.CLASSIFICATION + ML.FORECAST + Cortex). Deadline ~Nov 7-9 (confirm).

## Two pivots that define the project (DON'T redo the dead ends)
1. **mood → physical load.** Wearables do NOT predict self-reported mood (r≈0, AUC 0.46). So the ML
   target is a deterministic physiological LOAD index (sleep/HR/HRV deviations vs personal baseline).
   Mood check-in stays as caregiver→manager comms, NOT a training target.
2. **regression forecast → episode classification.** ML.FORECAST does NOT beat naive persistence on
   load at any horizon (documented, kept only for the trajectory+band VISUAL). The real model is a
   classifier: "elevated-load episode in next 1-3 days", AUC 0.80, beats baselines, wearables matter.

## Status
- Phase 0 gates: ALL DONE (Snowflake trial, LifeSnaps, TigerHacks rules, iPhone Shortcut→webhook real data).
- Phase 1 foundation: DONE (schema, programs.csv verified, API contract + mocks).
- Phase 2 data science: DONE (load index src/load_index.py; episode model src/episode_model.py AUC 0.80).
- Phase 3 AI layer: DONE (Cortex briefs src/briefs.py; grounded-by-construction; guardrails tested).
- Phase 5 UI: DONE on mocks (web/, React+Vite+TS+Tailwind; verified 390px+1440px, light/dark).
- **Backend all runs IN Snowflake.** Tables populated: FEATURES, RISK, ALERTS, STRAIN_SCORE, FORECASTS,
  PROGRAMS(12), BRIEFS(26). Model objects: steady_episode (ML.CLASSIFICATION), steady_load_model (ML.FORECAST).

- Phase 4 backend: CORE DONE. FastAPI in server/ serves every contract endpoint from live Snowflake
  (repo.py) with a 60s cache; ingest normalizes the raw Shortcut payload + idempotent MERGE. 40 tests
  pass. Verified in-browser (390px+1440px) end-to-end against real data; single hosted link via web/dist
  mount + SPA fallback. Status retuned (risk bimodal -> building tier from forecast crossing personal p75).

## NEXT
- NEW: **src/score_live.py** — the RAW_DAILY(live) -> features/load-index -> STRAIN_SCORE -> ML.FORECAST
  -> RISK runner that makes an ingesting Apple Watch participant appear in the app. Reuses the exact
  demo feature code (build_features/load_index; load_index.build(daily=) + prep_series(indexed=) now
  accept injected data). SCOPED: only writes rows for the person_ids it scores; never touches the demo
  cohort. Honest framing: does NOT run the Fitbit-trained classifier on watch data — live status comes
  from the person's OWN forecast (building = crosses personal p75, heads_up = reaches p90). Offline
  tests in tests/test_score_live.py (5, all pass). Dry-run verified vs live Snowflake: p_roshan already
  ingesting but <30 days, correctly skipped. Run `.venv/bin/python -m src.score_live` after backfill.
  NOTE: stray `Steady/` nested checkout (gitlink, no .gitmodules — from the /opt/Steady deploy work) was
  breaking local pytest; added pytest.ini `norecursedirs` to exclude it. Worth cleaning up in git.
- Remaining Phase 4: on-phone 30-60d backfill (need the device; phone now POSTs straight to the EC2
  public IP over HTTP — tunnel no longer needed for ingest, see shortcuts/README.md). sql/05_tasks.sql
  nightly Task is WRITTEN + validated read-only, NOT applied (retrains models = credits; schedule the
  score_live Python step before it).
- Phase 5 write-path wiring: "Draft outreach" (real Cortex) + "Mark contacted" (persists to store) now
  wired in CaregiverDrawer via api.outreachDraft/markContacted — VERIFIED in-browser end-to-end.
  Still a stub: caregiver Heads-up "Not helpful" feedback (api.feedback / POST .../feedback not wired).
- NEW: "The signals behind this" — actual daily wearable metrics (resting HR, sleep, HRV, sleep
  efficiency, steps) with each person's own baseline + sparkline, so the status is backed by data.
  GET /api/caregivers/{id}/metrics (repo.metrics, from FEATURES); MetricsPanel.tsx on caregiver Today
  and care-manager drawer. Text shows position (above/below/in-range) via delta sign; color shows
  good/bad (worse=amber); steps neutral. low_data flag hides near-flat/imputed series. VERIFIED both
  surfaces in-browser.
- NEW: metric tiles are click-to-enlarge — MetricModal.tsx opens a large interactive Recharts line
  chart (full 21-day history, unit-aware Y axis, dashed personal-baseline line, hover crosshair +
  tooltip). Close via X / backdrop / Escape; z-30 so it sits above the manager drawer (z-20). Shared
  fmtValue moved to lib/metricFormat.ts. VERIFIED in-browser.
- Then: demo script, Devpost. Polish: brief wording still echoes "drivers ..." (Phase 3 8B artifact).

## Verify everything
```
.venv/bin/pytest -q            # 14 tests: leakage, guardrails, data-integrity (Snowflake-aware, skips offline)
.venv/bin/python -m src.episode_model   # model AUC 0.80 person-held-out vs baselines
.venv/bin/python -m src.backtest        # forecast honest MAE-by-horizon (loses to persistence — expected)
.venv/bin/python -m src.eval_llm        # LLM behavioral eval, pass-rate (100% last run)
```
Trust model: LLM output is grounded by construction (ids from code) + validated deterministically;
model trust = person-held-out metrics; data trust = integrity invariants. See CLAUDE.md for architecture.

## Env
Python venv .venv/; .env has Snowflake creds (account DL14171) + INGEST_TOKEN. Web: npm --prefix web run dev.
