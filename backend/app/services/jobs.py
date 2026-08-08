"""Threaded job manager: queues processing jobs, tracks progress, keeps
results in memory and mirrors them to SQLite."""

from __future__ import annotations

import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Optional

from app.core.config import MAX_WORKERS
from app.core.models import ParsedStatement
from app.export.sqlite_store import Store
from app.export.store import get_store
from app.services.pipeline import process_file

ProgressCb = Callable[[str, float, str], None]


class JobManager:
    def __init__(self, store: Optional[Store] = None) -> None:
        self._store = store or get_store()
        self._pool = ThreadPoolExecutor(max_workers=MAX_WORKERS)
        self._jobs: dict[str, dict[str, Any]] = {}
        self._lock = threading.Lock()

    # ------------------------------------------------------------------ #
    def create(self, filename: str) -> dict[str, Any]:
        job_id = uuid.uuid4().hex
        job = {
            "job_id": job_id,
            "filename": filename,
            "status": "queued",
            "progress": 0.0,
            "message": "Queued",
            "created_at": _now(),
            "finished_at": None,
            "error": None,
            "result": None,
        }
        with self._lock:
            self._jobs[job_id] = job
        return job

    def submit(self, job: dict[str, Any], file_path: str) -> None:
        self._pool.submit(self._run, job["job_id"], file_path)

    def _run(self, job_id: str, file_path: str) -> None:
        job = self._jobs[job_id]
        try:
            self._update(job_id, status="running", progress=2.0, message="Reading PDF")

            def progress(percent: float, message: str) -> None:
                self._update(job_id, progress=percent, message=message)

            parsed = process_file(file_path, job_id, progress)
            self._store.save_job(job_id, job["filename"], "completed", parsed)
            self._update(job_id, status="completed", progress=100.0, message="Completed", result=parsed)
        except Exception as exc:  # noqa: BLE001
            self._store.update_status(job_id, "failed", str(exc))
            self._update(job_id, status="failed", message="Failed", error=str(exc))

    def _update(
        self,
        job_id: str,
        *,
        status: Optional[str] = None,
        progress: Optional[float] = None,
        message: Optional[str] = None,
        error: Optional[str] = None,
        result: Optional[ParsedStatement] = None,
    ) -> None:
        with self._lock:
            job = self._jobs[job_id]
            if status is not None:
                job["status"] = status
            if progress is not None:
                job["progress"] = round(progress, 1)
            if message is not None:
                job["message"] = message
            if error is not None:
                job["error"] = error
            if result is not None:
                job["result"] = result
            if status in ("completed", "failed"):
                job["finished_at"] = _now()

    # ------------------------------------------------------------------ #
    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                return _job_summary(job)
        # Fall back to SQLite (e.g. after a restart).
        row = self._store.get_job(job_id)
        if row is None:
            return None
        return {
            "job_id": row["id"],
            "filename": row["filename"],
            "status": row["status"],
            "progress": 100.0 if row["status"] == "completed" else 0.0,
            "message": row["status"],
            "created_at": row["created_at"],
            "finished_at": row["finished_at"],
            "error": row["error"],
            "result": None,
        }

    def get_result(self, job_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None and job.get("result") is not None:
                return job["result"].to_dict()
        row = self._store.get_job(job_id)
        if row is None or not row.get("result_json"):
            return None
        import json

        return json.loads(row["result_json"])

    def apply_edits(self, job_id: str, edits: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
        """Patch transactions of a completed job, then recompute summary,
        validation and insights and persist the corrected result."""
        result = self.get_result(job_id)
        if result is None:
            return None

        from app.extraction.categorizer import categorize
        from app.services.pipeline import _attach_insights, rehydrate_parsed
        from app.services.stats import compute_summary
        from app.validation.checks import validate_statement

        parsed = rehydrate_parsed(result)
        txs = parsed.transactions

        scalar_fields = {"description", "reference", "category", "branch", "channel", "transaction_type"}
        date_fields = {"date", "value_date"}
        money_fields = {"debit", "credit", "balance"}

        def _coerce_date(value: Any):
            if value in (None, ""):
                return None
            from datetime import date as _date

            if isinstance(value, _date):
                return value
            text = str(value)
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
                from datetime import datetime

                try:
                    return datetime.strptime(text, fmt).date()
                except ValueError:
                    continue
            return None

        def _coerce_money(value: Any):
            if value in (None, ""):
                return None
            try:
                return float(str(value).replace(",", ""))
            except ValueError:
                return None

        changed = False
        for edit in edits:
            if not isinstance(edit, dict):
                continue
            index = edit.get("transaction_index")
            if not isinstance(index, int) or not 0 <= index < len(txs):
                continue
            tx = txs[index]
            for field, raw in (edit.get("fields") or {}).items():
                if field in scalar_fields:
                    setattr(tx, field, str(raw or ""))
                    changed = True
                elif field in date_fields:
                    setattr(tx, "tx_date" if field == "date" else "value_date", _coerce_date(raw))
                    changed = True
                elif field in money_fields:
                    setattr(tx, field, _coerce_money(raw))
                    changed = True

        if not changed:
            return result

        for tx in txs:
            if tx.description:
                tx.category = categorize(tx.description)
            tx.__post_init__()

        summary = compute_summary(txs, parsed.meta.currency)
        validation = validate_statement(txs, summary, parsed.validation.ocr_confidence)
        parsed.summary = summary
        parsed.validation = validation
        _attach_insights(parsed)

        filename = parsed.meta.file_name or result.get("filename") or "statement"
        self._store.save_job(job_id, filename, "completed", parsed)
        with self._lock:
            job = self._jobs.get(job_id)
            if job is not None:
                job["result"] = parsed
        return parsed.to_dict()

    def list_jobs(self, limit: int = 50) -> list[dict[str, Any]]:
        with self._lock:
            live = [_job_summary(j) for j in list(self._jobs.values())[-limit:]]
        live_ids = {j["job_id"] for j in live}
        persisted = []
        for j in self._store.list_jobs(limit=limit):
            if j["id"] in live_ids:
                continue
            persisted.append(
                {
                    "job_id": j["id"],
                    "filename": j["filename"],
                    "status": j["status"],
                    "progress": 100.0 if j["status"] == "completed" else 0.0,
                    "message": j["status"],
                    "created_at": j["created_at"],
                    "finished_at": j["finished_at"],
                    "error": j["error"],
                    "summary": {
                        "bank_name": (j.get("meta") or {}).get("bank_name"),
                    },
                }
            )
        merged = live + persisted
        merged.sort(key=lambda j: j.get("created_at") or "", reverse=True)
        return merged[:limit]

    def delete(self, job_id: str) -> bool:
        with self._lock:
            self._jobs.pop(job_id, None)
        self._store.delete_job(job_id)
        return True


def _job_summary(job: dict[str, Any]) -> dict[str, Any]:
    result = job.get("result")
    summary: dict[str, Any] = {}
    if result is not None:
        s = result.summary
        summary = {
            "transaction_count": len(result.transactions),
            "bank_name": result.meta.bank_name,
            "account_name": result.meta.account_name,
            "account_number": result.meta.account_number,
            "period_start": result.meta.period_start.isoformat() if result.meta.period_start else None,
            "period_end": result.meta.period_end.isoformat() if result.meta.period_end else None,
            "total_credits": s.total_credits,
            "total_debits": s.total_debits,
            "opening_balance": s.opening_balance,
            "closing_balance": s.closing_balance,
            "total_issues": len(result.validation.all_issues),
            "extraction_method": result.meta.extraction_method,
        }
    return {
        "job_id": job["job_id"],
        "filename": job["filename"],
        "status": job["status"],
        "progress": job["progress"],
        "message": job["message"],
        "created_at": job["created_at"],
        "finished_at": job["finished_at"],
        "error": job["error"],
        "summary": summary,
    }


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
