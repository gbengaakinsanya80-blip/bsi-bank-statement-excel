"""FastAPI routes for BSI."""

from __future__ import annotations

import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, File, HTTPException, Query, UploadFile
from fastapi.responses import Response

from app.core.config import UPLOAD_DIR
from app.export.sqlite_store import Store
from app.services.jobs import JobManager
from app.services.pipeline import build_export_bytes, rehydrate_parsed
from app.services.search import search as run_search

ALLOWED_EXTS = {".pdf"}
EXPORT_FORMATS = {"xlsx", "csv", "json", "pdf", "sqlite"}
EXPORT_MEDIA = {
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
    "json": "application/json",
    "pdf": "application/pdf",
    "sqlite": "application/vnd.sqlite3",
}


def build_router(jobs: JobManager, store: Store) -> APIRouter:
    router = APIRouter()

    @router.get("/health")
    def health() -> dict:
        import os

        from app.core.config import APP_NAME, VERSION

        from app.extraction.ocr import get_available_backend

        backend = get_available_backend()
        return {
            "status": "ok",
            "app": APP_NAME,
            "version": VERSION,
            "commit": os.environ.get("RENDER_GIT_COMMIT") or "local",
            "ocr_backend": backend.name if backend else None,
        }

    @router.get("/templates")
    def templates() -> dict:
        from app.extraction.bank_templates import get_supported_banks

        return {"banks": get_supported_banks()}

    @router.post("/process")
    def process(upload: UploadFile = File(...)) -> dict:
        if not upload.filename:
            raise HTTPException(400, "A file is required.")
        ext = Path(upload.filename).suffix.lower()
        if ext not in ALLOWED_EXTS:
            raise HTTPException(400, "Only PDF files are supported.")

        job = jobs.create(upload.filename)
        dest = UPLOAD_DIR / f"{job['job_id']}{ext}"
        with dest.open("wb") as fh:
            shutil.copyfileobj(upload.file, fh)
        jobs.submit(job, str(dest))
        return {"job_id": job["job_id"]}

    @router.get("/jobs")
    def list_jobs(limit: int = Query(50, ge=1, le=200)) -> dict:
        return {"jobs": jobs.list_jobs(limit=limit)}

    @router.get("/jobs/{job_id}")
    def get_job(job_id: str) -> dict:
        job = jobs.get(job_id)
        if job is None:
            raise HTTPException(404, "Job not found.")
        return job

    @router.delete("/jobs/{job_id}")
    def delete_job(job_id: str) -> dict:
        jobs.delete(job_id)
        return {"deleted": job_id}

    @router.get("/jobs/{job_id}/result")
    def job_result(job_id: str) -> dict:
        result = jobs.get_result(job_id)
        if result is None:
            raise HTTPException(404, "Result not found.")
        return result

    @router.post("/jobs/{job_id}/edits")
    def apply_edits(job_id: str, payload: dict = Body(...)) -> dict:
        edits = payload.get("edits", []) if isinstance(payload, dict) else []
        if not isinstance(edits, list):
            raise HTTPException(400, "edits must be a list.")
        result = jobs.apply_edits(job_id, edits)
        if result is None:
            raise HTTPException(404, "Result not found.")
        return result

    @router.get("/jobs/{job_id}/export")
    def export(job_id: str, format: str = Query("xlsx")) -> Response:
        if format not in EXPORT_FORMATS:
            raise HTTPException(400, f"format must be one of {sorted(EXPORT_FORMATS)}")
        result = jobs.get_result(job_id)
        if result is None:
            raise HTTPException(404, "Result not found.")
        try:
            parsed = rehydrate_parsed(result)
            content = build_export_bytes(parsed, format)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(500, f"Export failed: {exc}") from exc
        base = (result.get("meta") or {}).get("file_name", "statement") or "statement"
        stem = Path(base).stem or "statement"
        return Response(
            content=content,
            media_type=EXPORT_MEDIA[format],
            headers={"Content-Disposition": f'attachment; filename="{stem}.{format}"'},
        )

    @router.get("/search")
    def search(
        q: str = "",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        min_amount: Optional[float] = None,
        max_amount: Optional[float] = None,
        balance: Optional[float] = None,
        tx_type: str = "",
        category: str = "",
        job_id: str = "",
        limit: int = Query(SEARCH_DEFAULT_LIMIT, ge=1, le=5000),
    ) -> dict:
        return run_search(
            store,
            q=q,
            from_date=from_date,
            to_date=to_date,
            min_amount=min_amount,
            max_amount=max_amount,
            balance=balance,
            tx_type=tx_type,
            category=category,
            job_id=job_id,
            limit=limit,
        )

    return router


SEARCH_DEFAULT_LIMIT = 1000
