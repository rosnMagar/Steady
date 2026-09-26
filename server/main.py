"""Steady API. Reads computed results from Snowflake and serves them to the React front end.

Run: .venv/bin/uvicorn server.main:app --reload
Ingest routes need Authorization: Bearer <INGEST_TOKEN>; app read routes are open (hackathon demo).
"""
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from server import repo, store
from server.routes_ingest import router as ingest_router
from server.routes_caregiver import router as caregiver_router
from server.routes_cohort import router as cohort_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    store.init_db()
    # Give the caseload a little (clearly synthetic) contact history so the dashboard isn't blank.
    try:
        rows = repo.cohort_caregivers(sort="risk")["caregivers"]
        store.seed_demo_contacts([r["person_id"] for r in rows[5:10]])
    except Exception:
        pass  # offline / no Snowflake — server still boots for ingest + health
    yield


app = FastAPI(title="Steady API", version="1.0", lifespan=lifespan)

# Dev convenience: the Vite dev server proxies /api and /ingest, but allow direct cross-origin too.
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


app.include_router(ingest_router)
app.include_router(caregiver_router)
app.include_router(cohort_router)


@app.get("/api/methods")
def methods():
    return repo.methods()


# Serve the built PWA (web/dist) as a single hosted link, if it's been built. API routes above win.
# Real asset files are served directly; every other path falls back to index.html so client-side
# routes (/dashboard, /app/headsup, …) work on direct navigation and refresh (SPA history mode).
_DIST = Path(__file__).resolve().parent.parent / "web" / "dist"
if _DIST.is_dir():
    _ASSETS = _DIST / "assets"
    if _ASSETS.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_ASSETS)), name="assets")

    from fastapi import HTTPException
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}")
    def spa(full_path: str):
        if full_path.startswith(("api/", "ingest/")) or full_path == "health":
            raise HTTPException(status_code=404, detail="Not Found")  # unmatched API path -> JSON 404
        candidate = _DIST / full_path
        if full_path and candidate.is_file() and _DIST in candidate.resolve().parents:
            return FileResponse(candidate)
        return FileResponse(_DIST / "index.html")
