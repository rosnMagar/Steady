# TODO (phase order; add dates once the deadline is known)

## Phase 0 — Gates (each can change the plan)
- [x] Snowflake trial set up; ML.FORECAST and CORTEX.COMPLETE confirmed working (smoke test passed)
- [x] LifeSnaps downloaded (Zenodo 6832242, data/rais_anonymized.zip; CSVs in data/lifesnaps_csv/)
      TARGET DECIDED: daily strain from SEMA mood labels (cols ALERT/HAPPY/NEUTRAL/RESTED/SAD/TENSE-ANXIOUS/TIRED).
      71 people, 7410 daily rows, ~9mo; 31% of days labeled, 63/71 people, median 40 labeled days each.
      Backbone features resting_hr(~60%) + steps(~65%); rmssd/sleep/stress_score sparser. No weekly fallback needed.
- [x] iPhone Shortcut spike works — real Apple Watch data reached webhook 2026-09-26
      (steps, resting_heart_rate as string, sleep as raw stage intervals; HRV/active energy not sent).
      Real payload saved: shortcuts/sample_payloads/daily_raw_shortcut.json. Server must normalize it.
- [x] TigerHacks rules checked: Nov 7-9 2026 (CONFIRM), health theme, judged Technical&UX/Creativity/Health Impact/Presentation
      + ML/AI special award; Snowflake prize = LLM via Cortex REST API; submit ZIP + git repo; live science-fair demo; college students only

## Phase 1 — Foundation
- [x] Repo skeleton, .gitignore, .env.example, requirements.txt
- [ ] Python venv + install requirements; Vite React TS app in `web/`
- [x] Snowflake schema (sql/01_schema.sql: 9 tables) — not yet applied (needs .env creds)
- [ ] LifeSnaps loader (src/load_lifesnaps.py) — needs .env creds to load
- [x] `data/programs.csv` — 12 real programs, phones/URLs verified against official sources
- [x] API contract (server/API_CONTRACT.md) + mock JSON (web/src/mocks/*.json) committed

## Phase 2 — Data science core
- [x] Bite A: strain target from SEMA defined (binary multi-label flags)
- [x] Bite B: learned wearable->mood model FAILS to beat baseline (r~0, AUC 0.46) — documented negative result
- [x] PIVOT (user-aligned): target = deterministic physiological LOAD index, not learned mood.
      Mood check-in is caregiver->manager comms, not the ML target.
- [x] Bite B': load index built (src/load_index.py); dense (3364 rows/62 people).
      Forecast target = load_smooth (3-day EWMA): lag-1 autocorr 0.68, beats personal-mean for 97%.
- [ ] Feature pipeline no-leakage test (formalize)
- [x] Bite C: ML.FORECAST on load_smooth in Snowflake — WORKS. 51 people, 357 forecast rows
      (7d/person), intervals ordered & widen with horizon. STRAIN_SCORE(3584) + FORECASTS(357) populated.
- [x] Bite D: forecast backtest — ML.FORECAST does NOT beat persistence/personal-mean at any horizon
      (documented; smooth series -> random-walk-beats-model, known phenomenon). Keep FORECAST only for
      trajectory+uncertainty-band VISUAL, not an accuracy claim.
- [x] REFRAME (literature-backed): predict ELEVATED-LOAD EPISODE in next 1-3 days (classification).
      src/episode_model.py: AUC 0.803, beats persistence on F1 (0.577 vs 0.565) & precision (0.61 vs 0.55),
      person-held-out. Wearable features dominate (resting_hr_z, load_trend7, rmssd variability).
      This risk score drives status + cohort ranking (AUC = right metric for a ranking product).
      Stretch lever if time: intraday/hourly features (~0.83-0.85). Not blocking.
- [x] Path A: model runs IN Snowflake. src/train_snowflake_model.py:
      FEATURES table -> SNOWFLAKE.ML.CLASSIFICATION 'steady_episode' -> RISK -> ALERTS(status).
      51 people scored; status 38 steady / 13 heads_up. Sponsor story: train+infer in Snowflake ML.
      TODO tweak: status thresholds (0.33/0.60) give 0 "building" — retune to 0.25/0.55 at UI wiring.
- [x] Alert rule = status from risk thresholds (in ALERTS)

## Phase 3 — AI layer  [DONE]
- [x] Cortex COMPLETE briefs (caregiver note + manager brief), JSON output, in Snowflake. src/briefs.py
- [x] Program grounding by CONSTRUCTION: select_programs() picks ids in code, LLM writes prose only
      -> zero id-hallucination. PROGRAMS loaded (12). BRIEFS populated (26 rows: 13 caregiver+13 manager).
- [x] Guardrail tests pass (7): invented-id dropped, <=2 programs, medical-phrase flagged, 988 constant.
- [x] polish: reword driver phrases (8B echoed "drivers ..." — fixed, prompt relabeled); outreach-draft (real Cortex, wired); eval set (src/eval_llm.py)

## Phase 4 — Backend  [core DONE]
- [x] FastAPI ingest endpoints + tests (server/): /ingest/daily,/backfill,/checkin. normalize.py turns the
      raw Shortcut payload (ISO date, resting_hr string, sleep_raw intervals w/ U+202F space) into clean
      RAW_DAILY; idempotent MERGE on (person_id,date). tests/test_ingest.py + test_normalize.py (auth 401,
      idempotency, validation) pass. Auth is Bearer-tolerant (.env token literally = "Bearer Test123").
- [x] Caregiver + cohort endpoints reading Snowflake, with 60s TTL cache (server/repo.py, cache.py).
      All shapes match web/src/mocks + API_CONTRACT. VERIFIED in-browser at 390px+1440px against LIVE
      Snowflake: Today (forecast band+drivers), Heads-up (Cortex brief+programs), Cohort (KPIs+table+
      sparklines), drawer (brief+programs+contact history), Weekly load (projected band). No console errors.
      Status retune: risk is bimodal (no middle band) -> heads_up from model risk, BUILDING from forecast
      crossing personal p75 -> 34 steady / 4 building / 13 heads_up. cohort load band = Poisson-binomial.
      Single hosted link: FastAPI serves web/dist with SPA fallback (deep links work). `p_demo` alias ->
      top-risk person. Privacy: export resolves alias; delete does NOT (safe no-op from the app).
      Run: `.venv/bin/uvicorn server.main:app` then build UI with `VITE_USE_API=1 npm run build`.
- [ ] Tunnel/hosting; Shortcuts daily-sync, check-in, backfill wired; 30-60 days backfilled
      (endpoints + real-payload ingest confirmed live; tunnel + hosting DOCUMENTED in shortcuts/README.md
      — cloudflared to :8000, same URL serves API+UI; Cloudflare tunnel + on-phone backfill need the device)
- [x] Ingest triggers live rescore automatically — /ingest/daily and /ingest/backfill schedule
      src.score_live.run([person_id]) as a FastAPI BackgroundTask when source='apple_watch'; backfill
      dedupes so a 30-day POST fires ONE rescore per person, not 30. Then invalidates the 60s read
      cache so the next dashboard fetch sees the new state. Errors are logged, never raised (an
      ingest never fails because of a downstream refresh; nightly SQL Task remains a backstop).
      3 new tests in tests/test_ingest.py cover the scheduling; all 81 tests pass.
- [x] Snowflake Task for nightly refresh — sql/05_tasks.sql: REFRESH_STEADY() proc (ML.FORECAST retrain
      -> FORECASTS; steady_episode!PREDICT -> RISK; status rule -> ALERTS) + nightly TASK.
      APPLIED + RESUMED 2026-09-29. Schedule: 'USING CRON 59 23 * * * America/Chicago' (11:59 PM CDT
      today, auto-shifts to CST after Nov 2 via IANA name). SHOW TASKS: state=started. CAVEAT:
      FEATURES/STRAIN_SCORE are Python (src/), so the SQL Task only refreshes downstream — fine for
      the demo cohort (FEATURES pre-populated) but for the live Apple Watch person, `score_live.py`
      still runs separately.

## Phase 5 — UI (parallel with Phase 2, using mocks)
- [x] Design tokens, base components, light/dark (web/ Vite+React+TS+Tailwind; builds clean)
- [x] Caregiver: Welcome/Consent, Connect, Check-in, Today, Heads-up, Privacy
- [x] Care manager: Cohort overview, drawer, Weekly load
- [x] Methods & Limits page
- [x] Loading/empty/low-data/error states in all data views
- [x] Browser review at 390px (dark) and 1440px (light) — verified, no console errors, Y-axis fix applied
- [ ] Swap mocks for real endpoints (needs FastAPI server, Phase 4)
- [ ] PWA install (manifest + service worker); Lighthouse/axe formal pass

## Phase 6 — Demo and submission
- [ ] 3-minute script with a named caregiver story; live Shortcut moment, replay as fallback
- [ ] Pre-loaded demo data; core path independent of the tunnel
- [ ] Limitations/consent slide; architecture slide showing Snowflake's role
- [ ] Backup screen recording; README with setup and citations
- [ ] Devpost writeup and submission (writeup DRAFTED in DEVPOST.md — needs live URL, video link,
      screenshots, and the submission itself)

## Scope cuts (in order)
Simplify stage-1 model -> drop region filter -> drop dark mode -> drop Methods charts -> drop Cortex Search -> drop live sync.
Never cut: backtest, Methods & Limits page, caregiver Today and Heads-up screens.
