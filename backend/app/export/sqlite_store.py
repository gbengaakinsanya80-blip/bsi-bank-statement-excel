"""SQLite persistence: job history, parsed statements and search."""

from __future__ import annotations

import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import date
from pathlib import Path
from typing import Any, Iterator, Optional

from app.core.config import DB_DIR
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

_ACCOUNTING_SCHEMA = """
CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT NOT NULL,
    trading_name TEXT,
    reg_number TEXT,
    country TEXT DEFAULT 'Nigeria',
    currency TEXT DEFAULT 'NGN',
    industry TEXT DEFAULT 'general',
    accounting_basis TEXT DEFAULT 'cash',
    financial_year_end TEXT,
    opening_date TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    code TEXT,
    name TEXT,
    account_type TEXT,
    normal_balance TEXT,
    parent_code TEXT,
    is_system INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS accounting_periods (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'open',
    locked_at TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT,
    bank_name TEXT,
    account_number TEXT,
    currency TEXT DEFAULT 'NGN',
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS company_statements (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    job_id TEXT,
    bank_account_id TEXT,
    period_id TEXT,
    linked_at TEXT
);
CREATE TABLE IF NOT EXISTS classification_rules (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    name TEXT,
    match_type TEXT,
    match_value TEXT,
    account_code TEXT,
    enabled INTEGER DEFAULT 1,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS ai_memory (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    fingerprint TEXT,
    category TEXT,
    account_code TEXT,
    confidence REAL,
    rationale TEXT,
    times_seen INTEGER DEFAULT 1,
    last_seen TEXT
);
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    statement_id TEXT,
    job_id TEXT,
    row_index INTEGER,
    tx_date TEXT,
    description TEXT,
    reference TEXT,
    debit REAL,
    credit REAL,
    balance REAL,
    category TEXT,
    account_code TEXT,
    transaction_type TEXT,
    confidence REAL,
    rationale TEXT,
    status TEXT DEFAULT 'imported',
    source TEXT,
    source_page INTEGER,
    original_json TEXT
);
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    period_id TEXT,
    journal_no TEXT,
    tx_date TEXT,
    reference TEXT,
    description TEXT,
    status TEXT DEFAULT 'posted',
    source_type TEXT,
    source_id TEXT,
    created_by TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS journal_lines (
    id TEXT PRIMARY KEY,
    journal_id TEXT,
    account_code TEXT,
    debit REAL DEFAULT 0,
    credit REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS adjustments (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    period_id TEXT,
    adj_type TEXT,
    description TEXT,
    journal_id TEXT,
    amount REAL,
    approved_by TEXT,
    created_at TEXT
);
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    company_id TEXT,
    user_id TEXT,
    action TEXT,
    entity TEXT,
    entity_id TEXT,
    old_value TEXT,
    new_value TEXT,
    reason TEXT,
    created_at TEXT
);
"""

_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
"""

_ACCOUNTING_INDEXES = """
CREATE INDEX IF NOT EXISTS idx_coa_company ON chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_periods_company ON accounting_periods(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_company_statements_company ON company_statements(company_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_rules_company ON classification_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_company ON ai_memory(company_id);
CREATE INDEX IF NOT EXISTS idx_ledger_tx_company ON ledger_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_adjustments_company ON adjustments(company_id);
"""


class Store:
    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = Path(db_path or (DB_DIR / "bsi.db"))
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with self._conn() as conn:
            conn.executescript(_SCHEMA)
            conn.executescript(_ACCOUNTING_SCHEMA)
            self._migrate(conn)
            conn.executescript(_INDEXES)
            conn.executescript(_ACCOUNTING_INDEXES)

    @staticmethod
    def _migrate(conn: sqlite3.Connection) -> None:
        """Add columns introduced after the initial schema was created."""
        cols = {r[1] for r in conn.execute("PRAGMA table_info(transactions)").fetchall()}
        if cols and "category" not in cols:
            conn.execute("ALTER TABLE transactions ADD COLUMN category TEXT")
        jcols = {r[1] for r in conn.execute("PRAGMA table_info(jobs)").fetchall()}
        if jcols and "user_id" not in jcols:
            conn.execute("ALTER TABLE jobs ADD COLUMN user_id TEXT")
        ucols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
        if ucols:
            _USER_ADD_COLUMNS = {
                "plan": "TEXT NOT NULL DEFAULT 'free'",
                "paystack_customer_code": "TEXT",
                "subscription_id": "TEXT",
                "plan_expires_at": "TEXT",
                "usage_month": "TEXT",
                "usage_count": "INTEGER NOT NULL DEFAULT 0",
            }
            for col, ddl in _USER_ADD_COLUMNS.items():
                if col not in ucols:
                    conn.execute(f"ALTER TABLE users ADD COLUMN {col} {ddl}")
        lcols = {r[1] for r in conn.execute("PRAGMA table_info(ledger_transactions)").fetchall()}
        if lcols and "source" not in lcols:
            conn.execute("ALTER TABLE ledger_transactions ADD COLUMN source TEXT")
        jcols = {r[1] for r in conn.execute("PRAGMA table_info(journal_entries)").fetchall()}
        if jcols and "source_id" not in jcols:
            conn.execute("ALTER TABLE journal_entries ADD COLUMN source_id TEXT")

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
    # Users
    # ------------------------------------------------------------------ #
    def create_user(self, *, id: str, email: str, password_hash: str) -> dict:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (id, email, password_hash, _now()),
            )
        return {"id": id, "email": email, "password_hash": password_hash}

    def get_user_by_email(self, email: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None

    def get_user_by_subscription(self, subscription_id: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE subscription_id = ?", (subscription_id,)
            ).fetchone()
        return dict(row) if row else None

    def reset_usage(self, user_id: str) -> None:
        with self._conn() as conn:
            conn.execute(
                "UPDATE users SET usage_month = ?, usage_count = 0 WHERE id = ?",
                (_month_key(), user_id),
            )

    # ------------------------------------------------------------------ #
    # Billing / usage metering
    # ------------------------------------------------------------------ #
    def get_usage(self, user_id: str) -> tuple[Optional[str], int]:
        """Return (usage_month, usage_count) for the current month."""
        with self._conn() as conn:
            row = conn.execute("SELECT usage_month, usage_count FROM users WHERE id = ?", (user_id,)).fetchone()
        if row is None:
            return None, 0
        if row["usage_month"] != _month_key():
            return _month_key(), 0
        return row["usage_month"], row["usage_count"] or 0

    def record_usage(self, user_id: str) -> tuple[str, int]:
        """Increment the user's statement count for the current month
        (resetting when the month rolls over). Returns (month, count)."""
        month = _month_key()
        with self._conn() as conn:
            row = conn.execute(
                "SELECT usage_month, usage_count FROM users WHERE id = ?", (user_id,)
            ).fetchone()
            if row is None:
                return month, 0
            if row["usage_month"] != month:
                conn.execute(
                    "UPDATE users SET usage_month = ?, usage_count = 1 WHERE id = ?",
                    (month, user_id),
                )
                return month, 1
            count = (row["usage_count"] or 0) + 1
            conn.execute("UPDATE users SET usage_count = ? WHERE id = ?", (count, user_id))
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
        sets: list[str] = []
        params: list[Any] = []
        if plan is not None:
            sets.append("plan = ?")
            params.append(plan)
        if paystack_customer_code is not None:
            sets.append("paystack_customer_code = ?")
            params.append(paystack_customer_code)
        if subscription_id is not None:
            sets.append("subscription_id = ?")
            params.append(subscription_id)
        if plan_expires_at is not None:
            sets.append("plan_expires_at = ?")
            params.append(plan_expires_at)
        if clear_subscription:
            sets.extend(["subscription_id = NULL", "plan_expires_at = NULL"])
        if not sets:
            return
        params.append(user_id)
        with self._conn() as conn:
            conn.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = ?", params)

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
        with self._conn() as conn:
            conn.execute(
                "INSERT OR REPLACE INTO jobs (id, user_id, filename, status, created_at, finished_at, meta_json, result_json, error)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (job_id, user_id, filename, status, _now(), _now(), meta_json, result_json, error),
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

    def get_job(self, job_id: str, user_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            if user_id:
                row = conn.execute("SELECT * FROM jobs WHERE id = ? AND user_id = ?", (job_id, user_id)).fetchone()
            else:
                row = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        return dict(row) if row else None

    def list_jobs(self, limit: int = 100, user_id: Optional[str] = None) -> list[dict[str, Any]]:
        with self._conn() as conn:
            if user_id:
                rows = conn.execute(
                    "SELECT id, filename, status, created_at, finished_at, error, meta_json FROM jobs"
                    " WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
                    (user_id, limit),
                ).fetchall()
            else:
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

    def delete_job(self, job_id: str, user_id: Optional[str] = None) -> None:
        with self._conn() as conn:
            if user_id:
                conn.execute("DELETE FROM transactions WHERE job_id = ? AND job_id IN (SELECT id FROM jobs WHERE id = ? AND user_id = ?)", (job_id, job_id, user_id))
                conn.execute("DELETE FROM jobs WHERE id = ? AND user_id = ?", (job_id, user_id))
            else:
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
        user_id: Optional[str] = None,
        limit: int = 1000,
    ) -> list[dict[str, Any]]:
        clauses: list[str] = []
        params: list[Any] = []

        if user_id:
            clauses.append("j.user_id = ?")
            params.append(user_id)
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

    # ------------------------------------------------------------------ #
    # Companies
    # ------------------------------------------------------------------ #
    def create_company(
        self,
        *,
        user_id: str,
        name: str,
        trading_name: Optional[str] = None,
        reg_number: Optional[str] = None,
        country: str = "Nigeria",
        currency: str = "NGN",
        industry: str = "general",
        accounting_basis: str = "cash",
        financial_year_end: Optional[str] = None,
        opening_date: Optional[str] = None,
    ) -> dict[str, Any]:
        cid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO companies (id, user_id, name, trading_name, reg_number, country,"
                " currency, industry, accounting_basis, financial_year_end, opening_date, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (cid, user_id, name, trading_name, reg_number, country, currency,
                 industry, accounting_basis, financial_year_end, opening_date, _now()),
            )
        return self.get_company(cid, user_id)

    def get_company(self, company_id: str, user_id: Optional[str] = None) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            if user_id:
                row = conn.execute(
                    "SELECT * FROM companies WHERE id = ? AND user_id = ?", (company_id, user_id)
                ).fetchone()
            else:
                row = conn.execute("SELECT * FROM companies WHERE id = ?", (company_id,)).fetchone()
        return dict(row) if row else None

    def list_companies(self, user_id: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def update_company(self, company_id: str, user_id: str, **fields: Any) -> Optional[dict[str, Any]]:
        allowed = {
            "name", "trading_name", "reg_number", "country", "currency", "industry",
            "accounting_basis", "financial_year_end", "opening_date",
        }
        sets: list[str] = []
        params: list[Any] = []
        for key, value in fields.items():
            if key in allowed and value is not None:
                sets.append(f"{key} = ?")
                params.append(value)
        if not sets:
            return self.get_company(company_id, user_id)
        params.extend([company_id, user_id])
        with self._conn() as conn:
            conn.execute(
                f"UPDATE companies SET {', '.join(sets)} WHERE id = ? AND user_id = ?", params
            )
        return self.get_company(company_id, user_id)

    def delete_company(self, company_id: str, user_id: str) -> bool:
        with self._conn() as conn:
            conn.execute(
                "DELETE FROM journal_lines WHERE journal_id IN"
                " (SELECT id FROM journal_entries WHERE company_id = ?)",
                (company_id,),
            )
            for table in (
                "chart_of_accounts", "accounting_periods", "bank_accounts", "company_statements",
                "classification_rules", "ai_memory", "ledger_transactions", "journal_entries",
                "adjustments", "audit_logs",
            ):
                conn.execute(f"DELETE FROM {table} WHERE company_id = ?", (company_id,))
            cur = conn.execute(
                "DELETE FROM companies WHERE id = ? AND user_id = ?", (company_id, user_id)
            )
        return cur.rowcount > 0

    # ------------------------------------------------------------------ #
    # Chart of accounts
    # ------------------------------------------------------------------ #
    def replace_chart_of_accounts(self, company_id: str, accounts: list[dict[str, Any]]) -> None:
        with self._conn() as conn:
            conn.execute("DELETE FROM chart_of_accounts WHERE company_id = ?", (company_id,))
            conn.executemany(
                "INSERT INTO chart_of_accounts (id, company_id, code, name, account_type,"
                " normal_balance, parent_code, is_system) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        _new_id(), company_id, a.get("code"), a.get("name"), a.get("account_type"),
                        a.get("normal_balance"), a.get("parent_code"),
                        1 if a.get("is_system") else 0,
                    )
                    for a in accounts
                ],
            )

    def list_chart_of_accounts(self, company_id: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM chart_of_accounts WHERE company_id = ? ORDER BY code", (company_id,)
            ).fetchall()
        return [dict(r) for r in rows]

    def add_chart_account(
        self,
        company_id: str,
        *,
        code: str,
        name: str,
        account_type: str,
        normal_balance: str,
        parent_code: Optional[str] = None,
        is_system: bool = False,
    ) -> dict[str, Any]:
        aid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO chart_of_accounts (id, company_id, code, name, account_type,"
                " normal_balance, parent_code, is_system) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (aid, company_id, code, name, account_type, normal_balance, parent_code,
                 1 if is_system else 0),
            )
        return self.get_chart_account(aid, company_id)

    def get_chart_account(self, account_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM chart_of_accounts WHERE id = ? AND company_id = ?",
                (account_id, company_id),
            ).fetchone()
        return dict(row) if row else None

    def get_chart_account_by_code(self, company_id: str, code: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM chart_of_accounts WHERE company_id = ? AND code = ?",
                (company_id, code),
            ).fetchone()
        return dict(row) if row else None

    def update_chart_account(self, account_id: str, company_id: str, **fields: Any) -> Optional[dict[str, Any]]:
        allowed = {"code", "name", "account_type", "normal_balance", "parent_code"}
        sets: list[str] = []
        params: list[Any] = []
        for key, value in fields.items():
            if key in allowed and value is not None:
                sets.append(f"{key} = ?")
                params.append(value)
        if not sets:
            return self.get_chart_account(account_id, company_id)
        params.extend([account_id, company_id])
        with self._conn() as conn:
            conn.execute(
                f"UPDATE chart_of_accounts SET {', '.join(sets)} WHERE id = ? AND company_id = ?",
                params,
            )
        return self.get_chart_account(account_id, company_id)

    def delete_chart_account(self, account_id: str, company_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM chart_of_accounts WHERE id = ? AND company_id = ?",
                (account_id, company_id),
            )
        return cur.rowcount > 0

    # ------------------------------------------------------------------ #
    # Accounting periods
    # ------------------------------------------------------------------ #
    def create_period(
        self,
        company_id: str,
        *,
        name: str,
        start_date: str,
        end_date: str,
        status: str = "open",
    ) -> dict[str, Any]:
        pid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO accounting_periods (id, company_id, name, start_date, end_date, status, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (pid, company_id, name, start_date, end_date, status, _now()),
            )
        return self.get_period(pid, company_id)

    def get_period(self, period_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM accounting_periods WHERE id = ? AND company_id = ?",
                (period_id, company_id),
            ).fetchone()
        return dict(row) if row else None

    def list_periods(self, company_id: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM accounting_periods WHERE company_id = ? ORDER BY start_date",
                (company_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def update_period(self, period_id: str, company_id: str, **fields: Any) -> Optional[dict[str, Any]]:
        allowed = {"name", "start_date", "end_date", "status", "locked_at"}
        sets: list[str] = []
        params: list[Any] = []
        for key, value in fields.items():
            if key in allowed and value is not None:
                sets.append(f"{key} = ?")
                params.append(value)
        if not sets:
            return self.get_period(period_id, company_id)
        params.extend([period_id, company_id])
        with self._conn() as conn:
            conn.execute(
                f"UPDATE accounting_periods SET {', '.join(sets)} WHERE id = ? AND company_id = ?",
                params,
            )
        return self.get_period(period_id, company_id)

    # ------------------------------------------------------------------ #
    # Bank accounts
    # ------------------------------------------------------------------ #
    def create_bank_account(
        self,
        company_id: str,
        *,
        name: str,
        bank_name: str = "",
        account_number: str = "",
        currency: str = "NGN",
    ) -> dict[str, Any]:
        bid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO bank_accounts (id, company_id, name, bank_name, account_number, currency, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (bid, company_id, name, bank_name, account_number, currency, _now()),
            )
        return self.get_bank_account(bid, company_id)

    def get_bank_account(self, bank_account_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM bank_accounts WHERE id = ? AND company_id = ?",
                (bank_account_id, company_id),
            ).fetchone()
        return dict(row) if row else None

    def list_bank_accounts(self, company_id: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM bank_accounts WHERE company_id = ? ORDER BY created_at",
                (company_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_bank_account(self, bank_account_id: str, company_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM bank_accounts WHERE id = ? AND company_id = ?",
                (bank_account_id, company_id),
            )
        return cur.rowcount > 0

    # ------------------------------------------------------------------ #
    # Company statements (linking)
    # ------------------------------------------------------------------ #
    def link_statement(
        self,
        *,
        company_id: str,
        user_id: str,
        job_id: str,
        bank_account_id: Optional[str] = None,
        period_id: Optional[str] = None,
    ) -> dict[str, Any]:
        sid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO company_statements (id, company_id, user_id, job_id, bank_account_id, period_id, linked_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (sid, company_id, user_id, job_id, bank_account_id, period_id, _now()),
            )
        return self.get_company_statement(sid, company_id)

    def get_company_statement(self, statement_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM company_statements WHERE id = ? AND company_id = ?",
                (statement_id, company_id),
            ).fetchone()
        return dict(row) if row else None

    def list_company_statements(self, company_id: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM company_statements WHERE company_id = ? ORDER BY linked_at DESC",
                (company_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_company_statement(self, statement_id: str, company_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM company_statements WHERE id = ? AND company_id = ?",
                (statement_id, company_id),
            )
        return cur.rowcount > 0

    # ------------------------------------------------------------------ #
    # Ledger transactions (classified statement rows)
    # ------------------------------------------------------------------ #
    def delete_statement_ledger_transactions(self, statement_id: str, company_id: str) -> int:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM ledger_transactions WHERE statement_id = ? AND company_id = ?",
                (statement_id, company_id),
            )
        return cur.rowcount

    def import_ledger_transactions(
        self, *, company_id: str, statement_id: str, job_id: str, rows: list[dict[str, Any]]
    ) -> int:
        with self._conn() as conn:
            conn.executemany(
                "INSERT INTO ledger_transactions (id, company_id, statement_id, job_id, row_index,"
                " tx_date, description, reference, debit, credit, balance, category, account_code,"
                " transaction_type, confidence, rationale, status, source, source_page, original_json)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    (
                        _new_id(), company_id, statement_id, job_id, r.get("row_index"),
                        r.get("tx_date"), r.get("description"), r.get("reference"),
                        r.get("debit"), r.get("credit"), r.get("balance"), r.get("category"),
                        r.get("account_code"), r.get("transaction_type"), r.get("confidence"),
                        r.get("rationale"), r.get("status", "imported"), r.get("source"),
                        r.get("source_page"), r.get("original_json"),
                    )
                    for r in rows
                ],
            )
        return len(rows)

    def list_ledger_transactions(
        self, company_id: str, status: Optional[str] = None, limit: int = 200, offset: int = 0
    ) -> list[dict[str, Any]]:
        with self._conn() as conn:
            if status:
                rows = conn.execute(
                    "SELECT * FROM ledger_transactions WHERE company_id = ? AND status = ?"
                    " ORDER BY tx_date, row_index LIMIT ? OFFSET ?",
                    (company_id, status, limit, offset),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM ledger_transactions WHERE company_id = ?"
                    " ORDER BY tx_date, row_index LIMIT ? OFFSET ?",
                    (company_id, limit, offset),
                ).fetchall()
        return [dict(r) for r in rows]

    def get_ledger_transaction(self, txn_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM ledger_transactions WHERE id = ? AND company_id = ?",
                (txn_id, company_id),
            ).fetchone()
        return dict(row) if row else None

    def update_ledger_transaction(self, txn_id: str, company_id: str, **fields: Any) -> Optional[dict[str, Any]]:
        allowed = {
            "category", "account_code", "transaction_type", "confidence", "rationale", "status",
            "description", "reference", "debit", "credit", "balance", "tx_date", "source",
        }
        sets: list[str] = []
        params: list[Any] = []
        for key, value in fields.items():
            if key in allowed and value is not None:
                sets.append(f"{key} = ?")
                params.append(value)
        if not sets:
            return self.get_ledger_transaction(txn_id, company_id)
        params.extend([txn_id, company_id])
        with self._conn() as conn:
            conn.execute(
                f"UPDATE ledger_transactions SET {', '.join(sets)} WHERE id = ? AND company_id = ?",
                params,
            )
        return self.get_ledger_transaction(txn_id, company_id)

    # ------------------------------------------------------------------ #
    # Journal entries (posting output)
    # ------------------------------------------------------------------ #
    def create_journal_entry(
        self,
        company_id: str,
        *,
        period_id: Optional[str] = None,
        journal_no: str,
        tx_date: str,
        reference: str,
        description: str,
        status: str = "posted",
        source_type: Optional[str] = None,
        source_id: Optional[str] = None,
        created_by: Optional[str] = None,
        lines: list[dict[str, Any]],
    ) -> dict[str, Any]:
        eid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO journal_entries (id, company_id, period_id, journal_no, tx_date, reference,"
                " description, status, source_type, source_id, created_by, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (eid, company_id, period_id, journal_no, tx_date, reference, description, status,
                 source_type, source_id, created_by, _now()),
            )
            conn.executemany(
                "INSERT INTO journal_lines (id, journal_id, account_code, debit, credit)"
                " VALUES (?, ?, ?, ?, ?)",
                [
                    (_new_id(), eid, line.get("account_code"), line.get("debit") or 0,
                     line.get("credit") or 0)
                    for line in lines
                ],
            )
        return self.get_journal_entry(eid, company_id)

    def get_journal_entry(self, journal_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM journal_entries WHERE id = ? AND company_id = ?",
                (journal_id, company_id),
            ).fetchone()
            if row is None:
                return None
            lines = conn.execute(
                "SELECT * FROM journal_lines WHERE journal_id = ? ORDER BY account_code", (journal_id,)
            ).fetchall()
        entry = dict(row)
        entry["lines"] = [dict(l) for l in lines]
        return entry

    def list_journal_entries(
        self,
        company_id: str,
        period_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[dict[str, Any]]:
        query = (
            "SELECT je.*,"
            " (SELECT COUNT(*) FROM journal_lines jl WHERE jl.journal_id = je.id) AS line_count,"
            " (SELECT COALESCE(SUM(jl.debit), 0) FROM journal_lines jl WHERE jl.journal_id = je.id)"
            " AS total_debit,"
            " (SELECT COALESCE(SUM(jl.credit), 0) FROM journal_lines jl WHERE jl.journal_id = je.id)"
            " AS total_credit"
            " FROM journal_entries je WHERE je.company_id = ?"
        )
        params: list[Any] = [company_id]
        if period_id:
            query += " AND je.period_id = ?"
            params.append(period_id)
        query += " ORDER BY je.created_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])
        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def delete_journal(self, journal_id: str, company_id: str) -> bool:
        with self._conn() as conn:
            conn.execute("DELETE FROM journal_lines WHERE journal_id = ?", (journal_id,))
            cur = conn.execute(
                "DELETE FROM journal_entries WHERE id = ? AND company_id = ?",
                (journal_id, company_id),
            )
        return cur.rowcount > 0

    def latest_journal_no(self, company_id: str) -> Optional[str]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT journal_no FROM journal_entries WHERE company_id = ?"
                " ORDER BY created_at DESC, id DESC LIMIT 1",
                (company_id,),
            ).fetchone()
        return row["journal_no"] if row else None

    def trial_balance(self, company_id: str, period_id: Optional[str] = None) -> list[dict[str, Any]]:
        query = (
            "SELECT jl.account_code AS code, a.name, a.account_type, a.normal_balance,"
            " COALESCE(SUM(jl.debit), 0) AS total_debit, COALESCE(SUM(jl.credit), 0) AS total_credit"
            " FROM journal_lines jl"
            " JOIN journal_entries je ON je.id = jl.journal_id"
            " JOIN chart_of_accounts a ON a.company_id = je.company_id AND a.code = jl.account_code"
            " WHERE je.company_id = ?"
        )
        params: list[Any] = [company_id]
        if period_id:
            query += " AND je.period_id = ?"
            params.append(period_id)
        query += " GROUP BY jl.account_code, a.name, a.account_type, a.normal_balance"
        query += " ORDER BY jl.account_code"
        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    # ------------------------------------------------------------------ #
    # Adjustments (manual journals with an approval step)
    # ------------------------------------------------------------------ #
    def create_adjustment(
        self,
        company_id: str,
        *,
        period_id: Optional[str] = None,
        adj_type: str,
        description: str,
        amount: float,
    ) -> dict[str, Any]:
        aid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO adjustments (id, company_id, period_id, adj_type, description, amount, created_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?)",
                (aid, company_id, period_id, adj_type, description, amount, _now()),
            )
        return self.get_adjustment(aid, company_id)

    def get_adjustment(self, adj_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM adjustments WHERE id = ? AND company_id = ?", (adj_id, company_id)
            ).fetchone()
        return dict(row) if row else None

    def list_adjustments(self, company_id: str, period_id: Optional[str] = None) -> list[dict[str, Any]]:
        query = "SELECT * FROM adjustments WHERE company_id = ?"
        params: list[Any] = [company_id]
        if period_id:
            query += " AND period_id = ?"
            params.append(period_id)
        query += " ORDER BY created_at DESC"
        with self._conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [dict(r) for r in rows]

    def update_adjustment(self, adj_id: str, company_id: str, **fields: Any) -> Optional[dict[str, Any]]:
        allowed = {"period_id", "adj_type", "description", "amount", "journal_id", "approved_by"}
        sets: list[str] = []
        params: list[Any] = []
        for key, value in fields.items():
            if key in allowed:
                sets.append(f"{key} = ?")
                params.append(value)
        if not sets:
            return self.get_adjustment(adj_id, company_id)
        params.extend([adj_id, company_id])
        with self._conn() as conn:
            conn.execute(
                f"UPDATE adjustments SET {', '.join(sets)} WHERE id = ? AND company_id = ?", params
            )
        return self.get_adjustment(adj_id, company_id)

    def delete_adjustment(self, adj_id: str, company_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM adjustments WHERE id = ? AND company_id = ?", (adj_id, company_id)
            )
        return cur.rowcount > 0

    # ------------------------------------------------------------------ #
    # Classification rules
    # ------------------------------------------------------------------ #
    def create_classification_rule(
        self,
        company_id: str,
        *,
        name: str,
        match_type: str,
        match_value: str,
        account_code: str,
        enabled: bool = True,
    ) -> dict[str, Any]:
        rid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO classification_rules (id, company_id, name, match_type, match_value,"
                " account_code, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (rid, company_id, name, match_type, match_value, account_code, 1 if enabled else 0, _now()),
            )
        return self.get_classification_rule(rid, company_id)

    def list_classification_rules(self, company_id: str) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM classification_rules WHERE company_id = ? ORDER BY created_at",
                (company_id,),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_classification_rule(self, rule_id: str, company_id: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM classification_rules WHERE id = ? AND company_id = ?",
                (rule_id, company_id),
            ).fetchone()
        return dict(row) if row else None

    def update_classification_rule(self, rule_id: str, company_id: str, **fields: Any) -> Optional[dict[str, Any]]:
        allowed = {"name", "match_type", "match_value", "account_code", "enabled"}
        sets: list[str] = []
        params: list[Any] = []
        for key, value in fields.items():
            if key in allowed and value is not None:
                sets.append(f"{key} = ?")
                params.append(1 if value is True else 0 if value is False else value)
        if not sets:
            return self.get_classification_rule(rule_id, company_id)
        params.extend([rule_id, company_id])
        with self._conn() as conn:
            conn.execute(
                f"UPDATE classification_rules SET {', '.join(sets)} WHERE id = ? AND company_id = ?",
                params,
            )
        return self.get_classification_rule(rule_id, company_id)

    def delete_classification_rule(self, rule_id: str, company_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM classification_rules WHERE id = ? AND company_id = ?",
                (rule_id, company_id),
            )
        return cur.rowcount > 0

    # ------------------------------------------------------------------ #
    # AI memory
    # ------------------------------------------------------------------ #
    def get_ai_memory(self, company_id: str, fingerprint: str) -> Optional[dict[str, Any]]:
        with self._conn() as conn:
            row = conn.execute(
                "SELECT * FROM ai_memory WHERE company_id = ? AND fingerprint = ?",
                (company_id, fingerprint),
            ).fetchone()
        return dict(row) if row else None

    def upsert_ai_memory(
        self,
        company_id: str,
        *,
        fingerprint: str,
        category: str,
        account_code: str,
        confidence: float = 0.95,
        rationale: Optional[str] = None,
    ) -> dict[str, Any]:
        existing = self.get_ai_memory(company_id, fingerprint)
        if existing:
            with self._conn() as conn:
                conn.execute(
                    "UPDATE ai_memory SET category = ?, account_code = ?, confidence = ?,"
                    " rationale = ?, times_seen = times_seen + 1, last_seen = ? WHERE id = ?",
                    (category, account_code, confidence, rationale, _now(), existing["id"]),
                )
            return self.get_ai_memory(company_id, fingerprint)
        mid = _new_id()
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO ai_memory (id, company_id, fingerprint, category, account_code,"
                " confidence, rationale, times_seen, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (mid, company_id, fingerprint, category, account_code, confidence, rationale, 1, _now()),
            )
        return self.get_ai_memory(company_id, fingerprint)

    def list_ai_memory(self, company_id: str, limit: int = 200) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM ai_memory WHERE company_id = ? ORDER BY times_seen DESC, last_seen DESC LIMIT ?",
                (company_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]

    def delete_ai_memory(self, memory_id: str, company_id: str) -> bool:
        with self._conn() as conn:
            cur = conn.execute(
                "DELETE FROM ai_memory WHERE id = ? AND company_id = ?",
                (memory_id, company_id),
            )
        return cur.rowcount > 0


    # ------------------------------------------------------------------ #
    # Audit log
    # ------------------------------------------------------------------ #
    def add_audit_log(
        self,
        *,
        company_id: str,
        user_id: str,
        action: str,
        entity: str,
        entity_id: Optional[str] = None,
        old_value: Optional[str] = None,
        new_value: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> None:
        with self._conn() as conn:
            conn.execute(
                "INSERT INTO audit_logs (id, company_id, user_id, action, entity, entity_id,"
                " old_value, new_value, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (_new_id(), company_id, user_id, action, entity, entity_id,
                 old_value, new_value, reason, _now()),
            )

    def list_audit_logs(self, company_id: str, limit: int = 200) -> list[dict[str, Any]]:
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM audit_logs WHERE company_id = ? ORDER BY created_at DESC LIMIT ?",
                (company_id, limit),
            ).fetchall()
        return [dict(r) for r in rows]


def _now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _month_key() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m")


def _new_id() -> str:
    return uuid.uuid4().hex
