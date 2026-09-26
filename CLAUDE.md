# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

Early-stage hackathon build (TigerHacks 2026). The repo is currently scaffolding: `README.md`,
`TODO.md`, `.env.example`, `requirements.txt`, and a Python venv. The directories `sql/ src/
server/ web/ shortcuts/ tests/` exist but are mostly empty. The authoritative design lives in the
approved plan at `~/.claude/plans/pasted-content-id-1d72-here-s-a-lucky-octopus.md` and the checklist
in `TODO.md` — read both before adding code, and keep `TODO.md` in sync as phases complete.

## Commands

Python (run from repo root; venv is at `.venv/`):
- Install: `.venv/bin/pip install -r requirements.txt`
- Run API: `.venv/bin/uvicorn server.main:app --reload`
- All tests: `.venv/bin/pytest`
- Single test: `.venv/bin/pytest tests/test_features_leakage.py::test_name -q`

Web (once `web/` is a Vite app): `npm --prefix web install`, `npm --prefix web run dev`,
`npm --prefix web run build`.

Snowflake SQL in `sql/` is applied in numeric order (`01_schema` → `05_tasks`) against the trial
account configured in `.env` (copy from `.env.example`).

## Architecture (the big picture)

One data flow, four layers. Understanding it requires seeing how the pieces connect, not any single
file:

1. **Ingest.** An iPhone Shortcut POSTs daily wearable aggregates and a self-report check-in to
   FastAPI (`server/`), authenticated by a shared bearer token (`INGEST_TOKEN`). LifeSnaps (the
   public training dataset, loaded once via `src/load_lifesnaps.py`) and the live Apple Watch
   participant flow into the *same* Snowflake tables, distinguished by a `source` column.
2. **Snowflake is the system of record and the compute.** Raw → features (rolling windows +
   per-person baseline deviations) → a **stage-1 strain score** (a trained sklearn/LightGBM model in
   `src/strain_model.py`) → **`SNOWFLAKE.ML.FORECAST`** projecting each person's score 7 days ahead
   (multi-series via `SERIES_COLNAME => person_id`) → alerts → **Cortex `COMPLETE`** briefs. A
   nightly Task re-runs this chain.
3. **API.** FastAPI reads computed results from Snowflake and serves them to the front end, caching
   the demo cohort so the UI never waits on a warehouse cold start. Ingest routes and read routes are
   separate concerns.
4. **UI.** React (Vite + TS) — a mobile-first PWA for caregivers and a desktop dashboard for care
   managers, plus a shared Methods & Limits page. Built against mock JSON first, then wired to real
   endpoints.

### Two non-obvious design decisions that constrain the code
- **Wearables cannot feed the forecast directly.** `ML.FORECAST` exogenous variables require *future*
  values, which don't exist for live wearables. Hence the two-stage split: a model turns wearables
  into a strain score, and the forecast runs on that score's history alone.
- **Personal baselines, not population thresholds.** Features are deviations from each person's own
  normal (z-scores). This is what lets the Apple Watch participant (Fitbit-trained model, differently
  defined metrics) plug in at all — and it's still unvalidated for that participant, so present it as
  a live-pipeline demo, not model validation.

## Guardrails that must not regress

These are correctness requirements, verified by tests:
- **No leakage.** Features use only past data; splits are person-aware (GroupKFold). The strain model
  must beat a naive "yesterday's value" baseline to be worth keeping.
- **Cortex is grounded.** Caregiver/care-manager text may cite *only* rows from the `PROGRAMS` table —
  never invented programs. It must not diagnose or give medical advice, and crisis language must
  escalate to 988. `tests/test_guardrails.py` enforces this.
- **Framing is honest.** Training data is general Fitbit wearers, not caregivers; "strain" is a proxy
  for self-reported stress/mood; n=71. Keep this disclosure in the UI (Methods & Limits) and any
  pitch material.

## Privacy constraints

Send only daily aggregates (never raw HR streams or location). Identifiers are pseudonymous
`person_id`s. Support export and delete-by-person. This is opt-in decision support, not surveillance —
no employer-facing use.
