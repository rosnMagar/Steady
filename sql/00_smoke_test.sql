-- Phase 0 gate: confirm this Snowflake account/region can run the two features Steady needs.
-- Paste into a Snowsight worksheet and run top to bottom. Each block prints a result or errors.
-- If a block errors, note the exact message — it tells us whether it's a region, edition, or
-- privilege problem (and whether we need cross-region inference turned on).

-- 0. Where am I? Region + edition determine Cortex/ML availability.
SELECT CURRENT_ACCOUNT()      AS account,
       CURRENT_REGION()       AS region,
       CURRENT_VERSION()      AS version;

-- 1. Warehouse + database (create if you haven't). XS is plenty for the hackathon.
CREATE WAREHOUSE IF NOT EXISTS STEADY_WH
  WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE;
CREATE DATABASE IF NOT EXISTS STEADY;
USE WAREHOUSE STEADY_WH;
USE DATABASE STEADY;
USE SCHEMA PUBLIC;

-- 2. GATE A — Cortex LLM (this is what the Snowflake prize rewards).
-- If this errors with a region/availability message, we enable cross-region inference:
--   (run as ACCOUNTADMIN)  ALTER ACCOUNT SET CORTEX_ENABLED_CROSS_REGION = 'ANY_REGION';
SELECT SNOWFLAKE.CORTEX.COMPLETE(
  'llama3.1-8b',
  'Reply with exactly the word: OK'
) AS cortex_check;

-- 3. GATE B — ML.FORECAST on a tiny 2-series table.
CREATE OR REPLACE TABLE _smoke_series (
  person_id STRING, ts DATE, y FLOAT
);
INSERT INTO _smoke_series
SELECT 'p1', DATEADD('day', seq, '2026-01-01'), 50 + 10*SIN(seq/3.0) + UNIFORM(-3,3,RANDOM())
FROM (SELECT SEQ4() AS seq FROM TABLE(GENERATOR(ROWCOUNT => 30)));
INSERT INTO _smoke_series
SELECT 'p2', DATEADD('day', seq, '2026-01-01'), 70 + 5*SIN(seq/4.0) + UNIFORM(-3,3,RANDOM())
FROM (SELECT SEQ4() AS seq FROM TABLE(GENERATOR(ROWCOUNT => 30)));

CREATE OR REPLACE SNOWFLAKE.ML.FORECAST _smoke_model(
  INPUT_DATA       => TABLE(_smoke_series),
  SERIES_COLNAME   => 'person_id',
  TIMESTAMP_COLNAME=> 'ts',
  TARGET_COLNAME   => 'y'
);
CALL _smoke_model!FORECAST(FORECASTING_PERIODS => 7);

-- 4. Cleanup.
DROP SNOWFLAKE.ML.FORECAST IF EXISTS _smoke_model;
DROP TABLE IF EXISTS _smoke_series;
