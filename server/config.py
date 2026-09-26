"""Settings from .env (same file src/snowflake_io.py reads). No secrets hard-coded."""
import os
from pathlib import Path
from dotenv import dotenv_values

_ENV = dotenv_values(Path(__file__).resolve().parent.parent / ".env")


def get(key: str, default: str | None = None) -> str | None:
    return _ENV.get(key) or os.getenv(key) or default


# Shared bearer token the iPhone Shortcut sends. If unset, ingest is effectively locked
# (any token fails), which is the safe default rather than open ingest.
INGEST_TOKEN = get("INGEST_TOKEN")

# Read-endpoint cache TTL (seconds). Keeps the UI instant and off the warehouse cold-start path.
CACHE_TTL = int(get("STEADY_CACHE_TTL", "60"))

# App workflow state (feedback, contacted, contact history) — local SQLite, not Snowflake.
DB_PATH = Path(__file__).resolve().parent.parent / "data" / "steady_app.db"

# Status tiers. heads_up comes from the episode-risk model; building is a rising forecast that
# crosses the person's own top-quartile ("load building toward your heads-up level"). The raw
# risk score is bimodal on this snapshot (no middle band), so the middle tier lives in the forecast.
HEADS_UP_RISK = 0.5
