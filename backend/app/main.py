"""FastAPI application entrypoint for BSI."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import build_router
from app.core.config import APP_NAME, VERSION
from app.export.store import get_store
from app.services.jobs import JobManager

_store = get_store()
_jobs = JobManager(store=_store)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield
    _jobs._pool.shutdown(wait=False)  # noqa: SLF001


app = FastAPI(title=APP_NAME, version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(build_router(_jobs, _store), prefix="/api")
