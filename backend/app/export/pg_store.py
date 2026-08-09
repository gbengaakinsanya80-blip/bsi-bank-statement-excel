"""PostgreSQL persistence for BSI history (jobs + transactions).

Provides a drop-in replacement for :class:`app.export.sqlite_store.Store`
so a hosted Postgres (e.g. Neon free tier) can be used instead of the local
SQLite file. Uploads and exports remain ephemeral by design: uploads are
read once during processing and exports are regenerated from ``result_json``
on demand, so the only persistent state is the history index below.

The module is imported lazily (only when ``DATABASE_URL`` is configured), so
local development and the test suite never need psycopg installed.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Iterator, Optional

from app.core.models import ParsedStatement

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    paystack_customer_code TEXT,
    subscription_id TEXT,
    plan_expires_at TEXT,
    usage_month TEXT,
    usage_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
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
    debit DOUBLE PRECISION,
    credit DOUBLE PRECISION,
    balance DOUBLE PRECISION,
    tx_type TEXT,
    category TEXT,
    page_number INTEGER,
    line_number INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tx_job ON transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
"""

_USER_MIGRATIONS = (
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS paystack_customer_code TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_id TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS plan_expires_at TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_month TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS usage_count INTEGER NOT NULL DEFAULT 0",
)


class PostgresStore:
    """History store backed by PostgreSQL (used when DATABASE_URL is set)."""

    def __init__(self, conninfo: Optional[str] = None, schema: bool = True) -> None:
        self.conninfo = conninfo or os.environ.get("DATABASE_URL", "")
        if not self.conninfo:
            raise ValueError("PostgresStore requires a DATABASE_URL connection string.")
        self._schema_ready = False
        if schema:
            self._ensure_schema()

    def _ensure_schema(self) -> None:
        if self._schema_ready:
            return
        with self._conn() as conn:
            with conn.cursor() as cur:
                cur.execute(_SCHEMA)
                # Idempotent migrations for older databases.
                for ddl in _USER_MIGRATIONS:
                    cur.execute(ddl)
        self._schema_ready = True

    def _conn(self) -> Iterator[Any]:
        import psycopg

        with psycopg.connect(self.conninfo, connect_timeout=10) as conn:
            yield conn

    # ------------------------------------------------------------------ #
    # Users
    # ------------------------------------------------------------------ #
    def create_user(self, *, id: str, email: str, password_hash: str) -> dict:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (id, email, password_hash, created_at) VALUES (%s, %s, %s, %s)",
                (id, email, password_hash, _now()),
            )
        return {"id": id, "email": email, "password_hash": password_hash}

    def get_user_by_email(self, email: str) -> Optional[dict]:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            row = cur.fetchone()
            colnames = [d.name for d in cur.description] if row else []
        return dict(zip(colnames, row)) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute("SELECT * FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            colnames = [d.name for d in cur.description] if row else []
        return dict(zip(colnames, row)) if row else None

    def get_user_by_subscription(self, subscription_id: str) -> Optional[dict]:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM users WHERE subscription_id = %s", (subscription_id,)
            )
            row = cur.fetchone()
            colnames = [d.name for d in cur.description] if row else []
        return dict(zip(colnames, row)) if row else None

    def reset_usage(self, user_id: str) -> None:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET usage_month = %s, usage_count = 0 WHERE id = %s",
                (_month_key(), user_id),
            )

    # ------------------------------------------------------------------ #
    # Billing / usage metering
    # ------------------------------------------------------------------ #
    def get_usage(self, user_id: str) -> tuple[Optional[str], int]:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT usage_month, usage_count FROM users WHERE id = %s", (user_id,)
            )
            row = cur.fetchone()
            colnames = [d.name for d in cur.description] if row else []
        if not row:
            return None, 0
        d = dict(zip(colnames, row))
        if d["usage_month"] != _month_key():
            return _month_key(), 0
        return d["usage_month"], d["usage_count"] or 0

    def record_usage(self, user_id: str) -> tuple[str, int]:
        self._ensure_schema()
        month = _month_key()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                "SELECT usage_month, usage_count FROM users WHERE id = %s", (user_id,)
            )
            row = cur.fetchone()
            colnames = [d.name for d in cur.description] if row else []
            if not row:
                return month, 0
            d = dict(zip(colnames, row))
            if d["usage_month"] != month:
                cur.execute(
                    "UPDATE users SET usage_month = %s, usage_count = 1 WHERE id = %s",
                    (month, user_id),
                )
                return month, 1
            count = (d["usage_count"] or 0) + 1
            cur.execute(
                "UPDATE users SET usage_count = %s WHERE id = %s", (count, user_id)
            )
            return month, count

    def update_user_plan(
        self,
        user_id: str,
        *,
        plan: Optional[str] = None,
        paystack_customer_code: Optional[str] = None,
        subscription_id: Optional[str] = None,
        plan_expires_at: Optional[str] = None,
        clear_subscription: bool = False,
    ) -> None:
        self._ensure_schema()
        sets: list[str] = []
        params: list[Any] = []
        if plan is not None:
            sets.append("plan = %s")
            params.append(plan)
        if paystack_customer_code is not None:
            sets.append("paystack_customer_code = %s")
            params.append(paystack_customer_code)
        if subscription_id is not None:
            sets.append("subscription_id = %s")
            params.append(subscription_id)
        if plan_expires_at is not None:
            sets.append("plan_expires_at = %s")
            params.append(plan_expires_at)
        if clear_subscription:
            sets.extend(["subscription_id = NULL", "plan_expires_at = NULL"])
        if not sets:
            return
        params.append(user_id)
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s", params)

    # ------------------------------------------------------------------ #
    def save_job(
        self,
        job_id: str,
        filename: str,
        status: str,
        parsed: Optional[ParsedStatement] = None,
        error: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> None:
        meta_json = json.dumps(parsed.meta.to_dict(), default=str) if parsed else None
        result_json = json.dumps(parsed.to_dict(), default=str) if parsed else None
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                "INSERT INTO jobs (id, user_id, filename, status, created_at, finished_at, meta_json, result_json, error)"
                " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
                " ON CONFLICT (id) DO UPDATE SET"
                " user_id = EXCLUDED.user_id, filename = EXCLUDED.filename, status = EXCLUDED.status,"
                " finished_at = EXCLUDED.finished_at, meta_json = EXCLUDED.meta_json,"
                " result_json = EXCLUDED.result_json, error = EXCLUDED.error",
                (job_id, user_id, filename, status, _now(), _now(), meta_json, result_json, error),
            )
            if parsed:
                cur.execute("DELETE FROM transactions WHERE job_id = %s", (job_id,))
                cur.executemany(
                    "INSERT INTO transactions (job_id, row_index, tx_date, value_date, description, reference,"
                    " debit, credit, balance, tx_type, category, page_number, line_number)"
                    " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
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
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(
                "UPDATE jobs SET status = %s, finished_at = %s, error = %s WHERE id = %s",
                (status, _now(), error, job_id),
            )

    def get_job(self, job_id: str, user_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            if user_id:
                cur.execute("SELECT * FROM jobs WHERE id = %s AND user_id = %s", (job_id, user_id))
            else:
                cur.execute("SELECT * FROM jobs WHERE id = %s", (job_id,))
            row = cur.fetchone()
            colnames = [d.name for d in cur.description] if row else []
        if row is None:
            return None
        return dict(zip(colnames, row))

    def list_jobs(self, limit: int = 100, user_id: Optional[str] = None) -> list[dict[str, Any]]:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            if user_id:
                cur.execute(
                    "SELECT id, filename, status, created_at, finished_at, error, meta_json FROM jobs"
                    " WHERE user_id = %s ORDER BY created_at DESC LIMIT %s",
                    (user_id, limit),
                )
            else:
                cur.execute(
                    "SELECT id, filename, status, created_at, finished_at, error, meta_json FROM jobs"
                    " ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
            rows = cur.fetchall()
            colnames = [d.name for d in cur.description] if rows else []
        out = []
        for row in rows:
            d = dict(zip(colnames, row))
            try:
                d["meta"] = json.loads(d.get("meta_json") or "{}")
            except (json.JSONDecodeError, TypeError):
                d["meta"] = {}
            d.pop("meta_json", None)
            d.pop("result_json", None)
            out.append(d)
        return out

    def delete_job(self, job_id: str, user_id: Optional[str] = None) -> None:
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            if user_id:
                cur.execute(
                    "DELETE FROM transactions WHERE job_id IN (SELECT id FROM jobs WHERE id = %s AND user_id = %s)",
                    (job_id, user_id),
                )
                cur.execute("DELETE FROM jobs WHERE id = %s AND user_id = %s", (job_id, user_id))
            else:
                cur.execute("DELETE FROM transactions WHERE job_id = %s", (job_id,))
                cur.execute("DELETE FROM jobs WHERE id = %s", (job_id,))

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
        user_id: Optional[str] = None,
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []

        if user_id:
            clauses.append("j.user_id = %s")
            params.append(user_id)
        if job_id:
            clauses.append("t.job_id = %s")
            params.append(job_id)
        if q:
            clauses.append("(t.description ILIKE %s OR t.reference ILIKE %s OR t.tx_date ILIKE %s)")
            like = f"%{q}%"
            params.extend([like, like, like])
        if from_date:
            clauses.append("t.tx_date >= %s")
            params.append(from_date)
        if to_date:
            clauses.append("t.tx_date <= %s")
            params.append(to_date)
        if min_amount is not None:
            clauses.append("(t.debit >= %s OR t.credit >= %s)")
            params.extend([min_amount, min_amount])
        if max_amount is not None:
            clauses.append("(t.debit <= %s OR t.credit <= %s)")
            params.extend([max_amount, max_amount])
        if balance is not None:
            clauses.append("ABS(t.balance - %s) < 0.005")
            params.append(balance)
        if tx_type:
            clauses.append("t.tx_type = %s")
            params.append(tx_type)
        if category:
            clauses.append("t.category = %s")
            params.append(category)

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        params.append(limit)
        query = (
            "SELECT t.*, j.filename, j.meta_json FROM transactions t"
            " LEFT JOIN jobs j ON t.job_id = j.id"
            f" {where} ORDER BY t.job_id, t.row_index LIMIT %s"
        )
        self._ensure_schema()
        with self._conn() as conn, conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
            colnames = [d.name for d in cur.description] if rows else []
        return [dict(zip(colnames, r)) for r in rows]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _month_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")
