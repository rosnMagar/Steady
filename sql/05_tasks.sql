-- Steady — nightly refresh (Phase 4).
-- Re-runs the IN-SNOWFLAKE part of the chain: strain-score history -> ML.FORECAST (7-day, per person,
-- 95% band) -> classification re-score -> RISK -> ALERTS. A single stored proc, called by a scheduled
-- Task so the API always serves fresh forecasts and statuses.
--
-- IMPORTANT SCOPE NOTE (two-stage design):
--   FEATURES and STRAIN_SCORE are engineered in PYTHON (src/features.py, src/load_index.py,
--   src/train_snowflake_model.py) from RAW_DAILY, because feature engineering (rolling windows,
--   personal z-scores, the load index) isn't practical in pure SQL. So this SQL Task refreshes
--   everything DOWNSTREAM of STRAIN_SCORE/FEATURES. Newly ingested RAW_DAILY only flows through once
--   the Python pipeline has rebuilt FEATURES + STRAIN_SCORE. In production, schedule that Python step
--   (cron / GitHub Action / container) to run first, then this Task — or fold both into one runner.
--
-- NOT APPLIED AUTOMATICALLY. Creating Tasks + retraining ML models consumes warehouse credits and
-- changes account state. Apply intentionally, e.g.:
--   .venv/bin/python -c "from src.snowflake_io import execute_script as e; e('sql/05_tasks.sql')"
-- (execute_script splits on ';' — the $$-quoted proc body below is one statement to it, which is fine.)

USE DATABASE STEADY;
USE SCHEMA PUBLIC;

-- Status thresholds mirror server/repo.py::status_of exactly:
--   heads_up if risk >= 0.5; else building if the 7-day forecast peak crosses the person's own p75.
-- Owner's-rights SQL procs resolve unqualified names against the OWNER's default namespace, not
-- the session's, so every object below is fully qualified as STEADY.PUBLIC.<name>. Otherwise a
-- CALL from a role with a different default DB (or the Task's own context) fails with
-- "Object 'X.Y.STRAIN_SCORE' does not exist or not authorized".
CREATE OR REPLACE PROCEDURE STEADY.PUBLIC.REFRESH_STEADY()
RETURNS STRING
LANGUAGE SQL
AS
$$
BEGIN
    -- 1. Forecast: retrain the multi-series model on the current strain-score history and project 7 days.
    CREATE OR REPLACE SNOWFLAKE.ML.FORECAST STEADY.PUBLIC.steady_load_model(
        INPUT_DATA     => TABLE(SELECT person_id, date, strain_score FROM STEADY.PUBLIC.STRAIN_SCORE),
        SERIES_COLNAME => 'PERSON_ID',
        TIMESTAMP_COLNAME => 'DATE',
        TARGET_COLNAME => 'STRAIN_SCORE');

    TRUNCATE TABLE STEADY.PUBLIC.FORECASTS;
    INSERT INTO STEADY.PUBLIC.FORECASTS (person_id, date, forecast, lower_bound, upper_bound)
        SELECT TRIM(series::string, '"'), ts::date, forecast, lower_bound, upper_bound
        FROM   TABLE(STEADY.PUBLIC.steady_load_model!FORECAST(FORECASTING_PERIODS => 7));

    -- 2. Re-score episode risk on each person's latest feature row (model trained in Python step).
    CREATE OR REPLACE TABLE STEADY.PUBLIC.RISK AS
        WITH latest AS (
            SELECT * FROM STEADY.PUBLIC.FEATURES
            QUALIFY ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY date DESC) = 1
        )
        SELECT person_id, date,
               STEADY.PUBLIC.steady_episode!PREDICT(
                   OBJECT_DELETE(OBJECT_CONSTRUCT(*), 'PERSON_ID', 'DATE', 'Y')
               ):probability['1']::float AS risk
        FROM latest;

    -- 3. Derive status (same rule as the API) and rebuild ALERTS.
    TRUNCATE TABLE STEADY.PUBLIC.ALERTS;
    INSERT INTO STEADY.PUBLIC.ALERTS (person_id, date, status, rule)
        WITH p75 AS (
            SELECT person_id,
                   PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY strain_score) AS p75
            FROM STEADY.PUBLIC.STRAIN_SCORE GROUP BY person_id
        ), fpeak AS (
            SELECT person_id, MAX(forecast) AS fpeak FROM STEADY.PUBLIC.FORECASTS GROUP BY person_id
        )
        SELECT r.person_id, r.date,
               CASE
                   WHEN r.risk >= 0.5 THEN 'heads_up'
                   WHEN f.fpeak >= p.p75 THEN 'building'
                   ELSE 'steady'
               END AS status,
               'risk ' || TO_VARCHAR(r.risk, '0.00') AS rule
        FROM STEADY.PUBLIC.RISK r
        LEFT JOIN p75   p ON p.person_id = r.person_id
        LEFT JOIN fpeak f ON f.person_id = r.person_id;

    RETURN 'refreshed FORECASTS + RISK + ALERTS';
END;
$$;

-- Nightly Task. Set the warehouse to your trial warehouse before applying. Tasks are created
-- SUSPENDED; resume to activate. Runs at 23:59 America/Chicago every day — the IANA name handles
-- the CST/CDT switch automatically, so this stays "11:59 PM local" through DST.
CREATE OR REPLACE TASK REFRESH_STEADY_NIGHTLY
    WAREHOUSE = COMPUTE_WH               -- <-- change to your warehouse name
    SCHEDULE  = 'USING CRON 59 23 * * * America/Chicago'
AS
    CALL REFRESH_STEADY();

-- To activate:   ALTER TASK REFRESH_STEADY_NIGHTLY RESUME;
-- To run once:   EXECUTE TASK REFRESH_STEADY_NIGHTLY;   (or CALL REFRESH_STEADY();)
-- To pause:      ALTER TASK REFRESH_STEADY_NIGHTLY SUSPEND;
