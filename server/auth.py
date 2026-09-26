"""Bearer-token auth for ingest routes. The iPhone Shortcut sends
`Authorization: Bearer <INGEST_TOKEN>`; app read routes are open for the hackathon demo.

Tolerant by design: the configured INGEST_TOKEN may be the bare secret ("Test123") or already
include the scheme ("Bearer Test123"), and the header may or may not repeat "Bearer". We normalize
both sides to the bare secret before comparing, so a header of `Bearer <secret>` always works.
"""
from fastapi import Header, HTTPException

from server.config import INGEST_TOKEN


def _secret(value: str) -> str:
    value = value.strip()
    if value.lower().startswith("bearer "):
        value = value[len("bearer "):].strip()
    return value


def require_ingest_token(authorization: str | None = Header(default=None)):
    if not INGEST_TOKEN:
        # No token configured -> ingest is locked shut (safe default), never wide open.
        raise HTTPException(status_code=503, detail="ingest not configured")
    if not authorization or _secret(authorization) != _secret(INGEST_TOKEN):
        raise HTTPException(status_code=401, detail="invalid or missing bearer token")
