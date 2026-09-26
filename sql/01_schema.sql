-- Steady schema. Run once against the STEADY database.
-- Convention: one row per (person_id, date) in the daily tables. person_id is pseudonymous.
USE DATABASE STEADY;
USE SCHEMA PUBLIC;

-- ── Ingested signals ────────────────────────────────────────────────────────
-- Union of LifeSnaps (loaded in bulk) and live Apple Watch data, told apart by SOURCE.
CREATE TABLE IF NOT EXISTS RAW_DAILY (
    person_id          STRING       NOT NULL,
    date               DATE         NOT NULL,
    steps              FLOAT,
    resting_hr         FLOAT,
    hrv_ms             FLOAT,          -- LifeSnaps rmssd; Apple Watch SDNN (documented as not comparable)
    sleep_minutes      FLOAT,
    sleep_efficiency   FLOAT,
    active_energy_kcal FLOAT,
    calories           FLOAT,
    source             STRING       NOT NULL DEFAULT 'lifesnaps',  -- 'lifesnaps' | 'apple_watch'
    loaded_at          TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (person_id, date)
);

-- Self-reported ground truth. strain_label is the normalized 0-100 target used for training.
-- detail keeps the raw components (SEMA mood counts, or the 1-5 check-in) for provenance.
CREATE TABLE IF NOT EXISTS LABELS (
    person_id     STRING       NOT NULL,
    date          DATE         NOT NULL,
    strain_label  FLOAT,                        -- 0-100
    detail        VARIANT,                       -- {"tense":.., "sad":.., ...} or {"stress_1_5":4}
    source        STRING       NOT NULL DEFAULT 'lifesnaps',
    PRIMARY KEY (person_id, date)
);

-- ── Model outputs ─────────────────────────────────────────────────────────────
-- Stage-1 strain score for EVERY day with usable wearables (denser than LABELS).
-- This is the series ML.FORECAST runs on.
CREATE TABLE IF NOT EXISTS STRAIN_SCORE (
    person_id     STRING       NOT NULL,
    date          DATE         NOT NULL,
    strain_score  FLOAT        NOT NULL,        -- 0-100
    model_version STRING,
    scored_at     TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (person_id, date)
);

-- Forecast horizon rows (future dates) with 95% interval, from SNOWFLAKE.ML.FORECAST.
CREATE TABLE IF NOT EXISTS FORECASTS (
    person_id     STRING       NOT NULL,
    date          DATE         NOT NULL,        -- future date
    forecast      FLOAT        NOT NULL,
    lower_bound   FLOAT,
    upper_bound   FLOAT,
    generated_at  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (person_id, date)
);

-- Heads-up state derived from the forecast vs the person's own baseline.
CREATE TABLE IF NOT EXISTS ALERTS (
    person_id     STRING       NOT NULL,
    date          DATE         NOT NULL,        -- date the alert was raised
    status        STRING       NOT NULL,        -- 'steady' | 'building' | 'heads_up'
    rule          STRING,                        -- human-readable trigger reason
    generated_at  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (person_id, date)
);

-- ── Reference + generated text ───────────────────────────────────────────────
-- Curated real support programs. Cortex may cite ONLY these rows (grounding guardrail).
CREATE TABLE IF NOT EXISTS PROGRAMS (
    program_id    STRING       NOT NULL PRIMARY KEY,
    name          STRING       NOT NULL,
    org           STRING,
    description   STRING,
    url           STRING,
    phone         STRING,
    tags          ARRAY,                         -- e.g. ['respite','financial','veterans']
    eligibility   STRING
);

-- Cortex-generated notes/briefs. audience distinguishes caregiver vs care-manager text.
CREATE TABLE IF NOT EXISTS BRIEFS (
    person_id     STRING       NOT NULL,
    date          DATE         NOT NULL,
    audience      STRING       NOT NULL,        -- 'caregiver' | 'manager'
    body          STRING,
    program_ids   ARRAY,                         -- programs cited, must exist in PROGRAMS
    model         STRING,
    generated_at  TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (person_id, date, audience)
);

-- Backtest results for the Methods & Limits page (no fabrication — populated by src/backtest.py).
CREATE TABLE IF NOT EXISTS BACKTEST_METRICS (
    metric        STRING       NOT NULL,        -- 'mae', 'alert_precision', 'alert_recall', 'median_lead_days'
    value         FLOAT,
    split         STRING,                        -- 'model' | 'naive_baseline'
    notes         STRING,
    computed_at   TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP()
);
