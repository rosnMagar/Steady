# Steady API contract (v1)

Frozen shapes the front end builds against. Mock JSON matching each response lives in
`web/src/mocks/`. All dates are `YYYY-MM-DD`. `status` is always one of `steady | building | heads_up`.
Strain values are 0–100 (higher = more strain). Auth: ingest routes require
`Authorization: Bearer <INGEST_TOKEN>`; app routes use a demo role header for the hackathon.

## Ingest (from iPhone Shortcuts)
The Shortcut sends the **raw** shape in `shortcuts/sample_payloads/daily_raw_shortcut.json`
(confirmed on-device 2026-09-26). The server normalizes on receipt, so ingest accepts messy input
and RAW_DAILY stays clean:
- `date`: ISO timestamp → stored as the local calendar date.
- `resting_heart_rate`: string → float `resting_hr`.
- `sleep_raw`: array of `{start,end,value}` stage intervals → `sleep_minutes` = summed minutes of
  intervals whose value is `Core|REM|Deep|Asleep` (Awake excluded). Parse start/end from the
  "MMM d, yyyy at h:mm a" format (note the narrow no-break space ` ` before AM/PM).
- `hrv_ms`, `active_energy_kcal`: optional; this Shortcut version omits them (nullable in RAW_DAILY).

Endpoints:
- `POST /ingest/daily` — body = raw shortcut payload. Idempotent upsert on (person_id, date).
  → `{ "ok": true, "person_id", "date" }`
- `POST /ingest/backfill` — `{ "days": [ <raw daily>, ... ] }` (≤60). → `{ "ok": true, "count" }`
- `POST /ingest/checkin` — body = `shortcuts/sample_payloads/checkin.json`. → `{ "ok": true }`

## Caregiver app
- `GET /api/caregivers/{id}/today` → **today.json**
- `GET /api/caregivers/{id}/headsup` → **headsup.json** (programs `[]` when status is `steady`)
- `POST /api/caregivers/{id}/feedback` — `{ "program_id", "helpful": true|false }` → `{ "ok": true }`
- `GET /api/caregivers/{id}/export` → full JSON dump of that person's rows
- `DELETE /api/caregivers/{id}/data` → `{ "ok": true, "deleted": <n> }`

## Care-manager dashboard
- `GET /api/cohort/summary` → **cohort_summary.json**
- `GET /api/cohort/caregivers?status=&sort=&q=` → **cohort_caregivers.json**
- `GET /api/cohort/load-forecast` → **cohort_load.json**
- `GET /api/cohort/caregivers/{id}` → **cohort_detail.json**
- `POST /api/cohort/caregivers/{id}/contacted` → `{ "ok": true }`
- `POST /api/cohort/caregivers/{id}/outreach-draft` → `{ "draft": "<Cortex text>" }`

## Shared
- `GET /api/methods` → **methods.json**
- `GET /health` → `{ "ok": true }`

### series[] element (used in today.json and cohort_detail.json)
`{ "date", "actual": <0-100|null>, "forecast": <0-100|null>, "lower": <0-100|null>, "upper": <0-100|null> }`
Past days have `actual` set and forecast fields null; future days have `forecast/lower/upper` set and
`actual` null. The dashed personal-baseline line is a single number in the parent object (`baseline`).

### driver[] element
`{ "label", "detail", "direction": "worse"|"better"|"steady" }`
