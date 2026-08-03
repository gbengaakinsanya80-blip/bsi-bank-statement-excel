"""SQLite persistence: job history, parsed statements and search."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Any, Iterator, Optional

from app.core.config import DB_DIR
from app.core.models import ParsedStatement

_SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    filename TEXT,
    status TEXT,
    created_at TEXT,
    finished_at TEXT,
    meta_json TEXT,
    result_json TEXT,
    error TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
    job_id TEXT,
    row_index INTEGER,
    tx_date TEXT,
    value_date TEXT,
    description TEXT,
    reference TEXT,
    debit REAL,
    credit REAL,
    balance REAL,
    tx_type TEXT,
    category TEXT,
    page_number INTEGER,
    line_number INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tx_job ON transactions(job_id);
"""


class Store:
    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = Path(db_path or (DB_DIR / "bsi.db"))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as conn:
            conn.executescript(_SCHEMA)
            self._migrate(conn)

    @staticmethod
    def _migrate(conn: sqlite3.Connection) -> None:
        """Add columns introduced after the initial schema was created."""
        cols = {r[1] for r in conn.execute("PRAGMA table_info(transactions)").fetchall()}
        if cols and "category" not in cols:
            conn.execute("ALTER TABLE transactions ADD COLUMN category TEXT")

    @contextmanager
    def _conn(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    # ------------------------------------------------------------------ #
    def save_job(
        self,
        job_id: str,
        filename: str,
        status: str,
        parsed: Optional[ParsedStatement] = None,
        error: Optional[str] = None,
    ) -> None:
        meta_json = json.dumps(parsed.meta.to_dict(), default=str) if parsed else None
        result_json = json.dumps(parsed.to_dict(), default=str) if parsed else None
        with self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO jobs (id, filename, status, created_at, finished_at, meta_json, result_json, error)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (job_id, filename, status, _now(), _now(), meta_json, result_json, error),
            )
            if parsed:
                conn.execute("DELETE FROM transactions WHERE job_id = ?", (job_id,))
                conn.executemany(
                    "INSERT INTO transactions (job_id, row_index, tx_date, value_date, description, reference,"
                    " debit, credit, balance, tx_type, category, page_number, line_number)"
                    " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [
                        (
                            job_id, i, t.tx_date.isoformat() if t.tx_date else None,
                            t.value_date.isoformat() if t.value_date else None,
                            t.description, t.reference, t.debit, t.credit, t.balance,
                            t.tx_type, t.category, t.page_number, t.line_number,
                        )
                        for i, t in enumerate(parsed.transactions)
                    ],
                )

    def update_status(self, job_id: str, status: str, error: Optional[str] = None) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE jobs SET status = ?, finished_at = ?, error = ? WHERE id = ?",
                (status, _now(), error, job_id),
            )

    def get_job(self, job_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return dict(row) if row else None

    def list_jobs(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT id, filename, status, created_at, finished_at, error, meta_json FROM jobs"
                " ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        out = []
        for row in rows:
            d = dict(row)
            try:
                d["meta"] = json.loads(d.get("meta_json") or "{}")
            except (json.JSONDecodeError, TypeError):
                d["meta"] = {}
            d.pop("meta_json", None)
            d.pop("result_json", None)
            out.append(d)
        return out

    def delete_job(self, job_id: str) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM transactions WHERE job_id = ?", (job_id,))
            conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))

    # ------------------------------------------------------------------ #
    def search_transactions(
        self,
        *,
        q: str = "",
        from_date: Optional[str] = None,
        to_date: Optional[str] = None,
        min_amount: Optional[float] = None,
        max_amount: Optional[float] = None,
        balance: Optional[float] = None,
        tx_type: str = "",
        category: str = "",
        job_id: str = "",
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []

        if job_id:
            clauses.append("t.job_id = ?")
            params.append(job_id)
        if q:
            clauses.append("(t.description LIKE ? OR t.reference LIKE ? OR t.tx_date LIKE ?)")
            like = f"%{q}%"
            params.extend([like, like, like])
        if from_date:
            clauses.append("t.tx_date >= ?")
            params.append(from_date)
        if to_date:
            clauses.append("t.tx_date <= ?")
            params.append(to_date)
        if min_amount is not None:
            clauses.append("(t.debit >= ? OR t.credit >= ?)")
            params.extend([min_amount, min_amount])
        if max_amount is not None:
            clauses.append("(t.debit <= ? OR t.credit <= ?)")
            params.extend([max_amount, max_amount])
        if balance is not None:
            clauses.append("ABS(t.balance - ?) < 0.005")
            params.append(balance)
        if tx_type:
            clauses.append("t.tx_type = ?")
            params.append(tx_type)
        if category:
            clauses.append("t.category = ?")
            params.append(category)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        params.append(limit)
        query = (
            "SELECT t.*, j.filename, j.meta_json FROM transactions t"
            " LEFT JOIN jobs j ON t.job_id = j.id"
            f" {where} ORDER BY t.job_id, t.row_index LIMIT ?"
        )
        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
