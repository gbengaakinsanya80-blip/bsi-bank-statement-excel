"""Standalone SQLite export.

Builds a self-contained `.sqlite3` database file (meta, summary, transactions
and validation) from a parsed statement, so results can be opened in any SQLite
tool or queried offline. Distinct from the internal search store.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from app.core.models import ParsedStatement


def to_sqlite(parsed: ParsedStatement) -> bytes:
    conn = sqlite3.connect(":memory:")
    try:
        _write_meta(conn, parsed)
        _write_summary(conn, parsed)
        _write_transactions(conn, parsed)
        _write_validation(conn, parsed)
        return conn.serialize()
    finally:
        conn.close()


def _write_meta(conn: sqlite3.Connection, parsed: ParsedStatement) -> None:
    conn.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT)")
    meta = parsed.meta.to_dict()
    rows = [(k, v if isinstance(v, str) else v) for k, v in meta.items() if v is not None]
    conn.executemany("INSERT INTO meta (key, value) VALUES (?, ?)", rows)


def _write_summary(conn: sqlite3.Connection, parsed: ParsedStatement) -> None:
    conn.execute("CREATE TABLE summary (key TEXT PRIMARY KEY, value REAL)")
    s = parsed.summary
    rows = [
        ("opening_balance", s.opening_balance),
        ("closing_balance", s.closing_balance),
        ("total_credits", s.total_credits),
        ("total_debits", s.total_debits),
        ("number_of_transactions", s.number_of_transactions),
        ("largest_debit", s.largest_debit),
        ("largest_credit", s.largest_credit),
        ("average_debit", s.average_debit),
        ("average_credit", s.average_credit),
        ("total_credit_count", s.total_credit_count),
        ("total_debit_count", s.total_debit_count),
    ]
    conn.executemany("INSERT INTO summary (key, value) VALUES (?, ?)", rows)


def _write_transactions(conn: sqlite3.Connection, parsed: ParsedStatement) -> None:
    conn.execute(
        "CREATE TABLE transactions ("
        " row_index INTEGER, tx_date TEXT, value_date TEXT, description TEXT, reference TEXT,"
        " debit REAL, credit REAL, balance REAL, currency TEXT, branch TEXT, channel TEXT,"
        " instrument_number TEXT, transaction_type TEXT, category TEXT, page_number INTEGER, line_number INTEGER,"
        " is_beginning_balance INTEGER, is_ending_balance INTEGER, is_estimated INTEGER"
        ")"
    )
    rows = []
    for i, t in enumerate(parsed.transactions):
        rows.append(
            (
                i,
                t.tx_date.isoformat() if t.tx_date else None,
                t.value_date.isoformat() if t.value_date else None,
                t.description,
                t.reference,
                t.debit,
                t.credit,
                t.balance,
                t.currency,
                t.branch,
                t.channel,
                t.instrument_number,
                t.tx_type,
                t.category,
                t.page_number,
                t.line_number,
                int(t.is_beginning_balance),
                int(t.is_ending_balance),
                int(t.is_estimated),
            )
        )
    conn.executemany(
        "INSERT INTO transactions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.execute("CREATE INDEX idx_transactions_date ON transactions(tx_date)")


def _write_validation(conn: sqlite3.Connection, parsed: ParsedStatement) -> None:
    conn.execute(
        "CREATE TABLE validation ("
        " section TEXT, issue_type TEXT, severity TEXT, message TEXT, page_number INTEGER,"
        " line_number INTEGER, expected REAL, actual REAL, transaction_index INTEGER, suggested_fix TEXT"
        ")"
    )
    v = parsed.validation
    sections: dict[str, list[Any]] = {
        "missing_rows": v.missing_rows,
        "balance_errors": v.balance_errors,
        "duplicate_entries": v.duplicate_entries,
        "unreadable_transactions": v.unreadable_transactions,
        "other_issues": v.other_issues,
    }
    rows = []
    for section, issues in sections.items():
        for issue in issues:
            rows.append(
                (
                    section,
                    issue.issue_type,
                    issue.severity,
                    issue.message,
                    issue.page_number,
                    issue.line_number,
                    issue.expected,
                    issue.actual,
                    issue.transaction_index,
                    issue.suggested_fix,
                )
            )
    conn.executemany("INSERT INTO validation VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", rows)
    conn.execute(
        "CREATE TABLE validation_meta (key TEXT PRIMARY KEY, value TEXT)"
    )
    conn.executemany(
        "INSERT INTO validation_meta (key, value) VALUES (?, ?)",
        [
            ("balance_reconciled", str(v.balance_reconciled)),
            ("transaction_count_match", str(v.transaction_count_match)),
            ("total_issues", str(len(rows))),
            ("ocr_confidence", str(v.ocr_confidence) if v.ocr_confidence is not None else ""),
        ],
    )
