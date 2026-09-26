# Steady — caregiver strain forecasting

Forecasts family-caregiver strain from wearable signals days before a crisis, matches caregivers to
real support programs with Snowflake Cortex, and rolls forecasts up into a weekly caseload view for
care managers. Built for TigerHacks 2026 (Snowflake and Reply tracks).

**Limits, stated up front:** training data (LifeSnaps) is general Fitbit wearers, not caregivers;
"strain" is proxied by validated stress/mood self-reports; n=71. This is a support tool, not a
diagnostic device.

See `TODO.md` for the build checklist and the approved plan for the full design.

## Layout
- `sql/` Snowflake schema, features, forecast, Cortex, tasks
- `src/` data loading, features, models, backtest, briefs
- `server/` FastAPI (Shortcuts ingest + app API)
- `web/` React front end
- `shortcuts/` iPhone Shortcut recipes and sample payloads
- `tests/`
