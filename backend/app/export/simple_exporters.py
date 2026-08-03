"""CSV, JSON and SQLite exporters."""

from __future__ import annotations

import csv
import gc
import io
import json
import os
import sqlite3
import tempfile
import time
from pathlib import Path
from typing import Any

from ..core.models import ParsedStatement, Transaction

CSV_COLUMNS = [
    "Date",
    "Value Date",
    "Description",
    "Reference",
    "Debit",
    "Credit",
    "Balance",
    "Currency",
    "Branch",
    "Channel",
    "Instrument Number",
    "Transaction Type",
    "Category",
    "Page",
    "Line",
    "Is Beginning Balance",
    "Is Ending Balance",
    "OCR Confidence",
]


def _csv_row(tx: Transaction) -> list[Any]:
    return [
        tx.tx_date.isoformat() if tx.tx_date else "",
        tx.value_date.isoformat() if tx.value_date else "",
        tx.description,
        tx.reference,
        tx.debit if tx.debit is not None else "",
        tx.credit if tx.credit is not None else "",
        tx.balance if tx.balance is not None else "",
        tx.currency,
        tx.branch,
        tx.channel,
        tx.instrument_number,
        tx.tx_type,
        tx.category,
        tx.page_number,
        tx.line_number,
        tx.is_beginning_balance,
        tx.is_ending_balance,
        tx.ocr_confidence if tx.ocr_confidence is not None else "",
    ]


def export_csv(parsed: ParsedStatement) -> bytes:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\r\n")
    writer.writerow(CSV_COLUMNS)
    for tx in parsed.transactions:
        writer.writerow(_csv_row(tx))
    return out.getvalue().encode("utf-8-sig")


def export_json(parsed: ParsedStatement) -> bytes:
    payload = parsed.to_dict()
    return json.dumps(payload, indent=2, ensure_ascii=False).encode("utf-8")


def export_sqlite(parsed: ParsedStatement) -> bytes:
    """Build a fully self-contained SQLite database and return its bytes."""
    fd, tmp_path = tempfile.mkstemp(suffix=".sqlite")
    os.close(fd)
    conn = sqlite3.connect(tmp_path)
    try:
        _populate_sqlite(conn, parsed)
        conn.commit()
    finally:
        conn.close()
        gc.collect()
    for _attempt in range(10):
        try:
            data = Path(tmp_path).read_bytes()
            os.unlink(tmp_path)
            return data
        except PermissionError:  # Windows may hold the handle momentarily
            time.sleep(0.05)
    data = Path(tmp_path).read_bytes()
    try:
        os.unlink(tmp_path)
    except OSError:  # noqa: BLE001
        pass
    return data


def _populate_sqlite(conn: sqlite3.Connection, parsed: ParsedStatement) -> None:

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT, value_date TEXT, description TEXT, reference TEXT,
            debit REAL, credit REAL, balance REAL, currency TEXT,
            branch TEXT, channel TEXT, instrument_number TEXT,
            transaction_type TEXT, category TEXT, page_number INTEGER, line_number INTEGER,
            is_beginning_balance INTEGER, is_ending_balance INTEGER,
            is_estimated INTEGER, ocr_confidence REAL, source_text TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS summary (
            key TEXT PRIMARY KEY, value TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS validation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            issue_type TEXT, severity TEXT, message TEXT,
            page_number INTEGER, line_number INTEGER,
            expected REAL, actual REAL, transaction_index INTEGER, suggested_fix TEXT
        )
        """
    )

    for tx in parsed.transactions:
        conn.execute(
            """
            INSERT INTO transactions (
                date, value_date, description, reference, debit, credit, balance,
                currency, branch, channel, instrument_number, transaction_type,
                category, page_number, line_number, is_beginning_balance, is_ending_balance,
                is_estimated, ocr_confidence, source_text
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                tx.tx_date.isoformat() if tx.tx_date else None,
                tx.value_date.isoformat() if tx.value_date else None,
                tx.description,
                tx.reference,
                tx.debit,
                tx.credit,
                tx.balance,
                tx.currency,
                tx.branch,
                tx.channel,
                tx.instrument_number,
                tx.tx_type,
                tx.category,
                tx.page_number,
                tx.line_number,
                int(tx.is_beginning_balance),
                int(tx.is_ending_balance),
                int(tx.is_estimated),
                tx.ocr_confidence,
                tx.source_text,
            ),
        )

    summary_items = parsed.summary.to_dict()
    summary_items.pop("monthly_cash_flow", None)
    summary_items.pop("daily_cash_flow", None)
    for k, v in summary_items.items():
        conn.execute("INSERT INTO summary (key, value) VALUES (?,?)", (k, json.dumps(v)))

    for issue in parsed.validation.all_issues:
        conn.execute(
            """
            INSERT INTO validation (
                issue_type, severity, message, page_number, line_number,
                expected, actual, transaction_index, suggested_fix
            ) VALUES (?,?,?,?,?,?,?,?,?)
            """,
            (
                issue.issue_type,
                issue.severity,
                issue.message,
                issue.page_number,
                issue.line_number,
                issue.expected,
                issue.actual,
                issue.transaction_index,
                issue.suggested_fix,
            ),
        )
