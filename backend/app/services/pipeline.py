"""Processing pipeline: run the extraction engine, save artifacts and
rehydrate stored results so exports survive restarts."""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Callable, Optional

from app.core.models import (
    ParsedStatement,
    StatementMeta,
    SummaryStats,
    Transaction,
    ValidationIssue,
    ValidationReport,
)
from app.export.sqlite_store import Store
from app.extraction.engine import ExtractionEngine


def process_file(
    file_path: str,
    job_id: str,
    progress_cb: Optional[Callable[[float, str], None]] = None,
) -> ParsedStatement:
    engine = ExtractionEngine()

    def _cb(percent: float, message: str) -> None:
        if progress_cb is not None:
            # engine reports 0..100 for the extraction stage; keep headroom for post-processing.
            progress_cb(5.0 + percent * 0.9, message)

    parsed = engine.process(file_path, _cb)
    if progress_cb is not None:
        progress_cb(97.0, "Finalising")
    return parsed


# ---------------------------------------------------------------------- #
# Export helpers
# ---------------------------------------------------------------------- #
def build_export_bytes(parsed: ParsedStatement, fmt: str) -> bytes:
    if fmt == "xlsx":
        return _build_xlsx(parsed)
    if fmt == "csv":
        return _build_csv(parsed)
    if fmt == "json":
        return _build_json(parsed)
    if fmt == "pdf":
        return _build_pdf(parsed)
    if fmt == "sqlite":
        return _build_sqlite(parsed)
    raise ValueError(f"Unsupported export format: {fmt}")


def _build_xlsx(parsed: ParsedStatement) -> bytes:
    from app.export.excel import build_excel

    return build_excel(parsed).getvalue()


def _build_csv(parsed: ParsedStatement) -> bytes:
    from app.export.csv_json import to_csv

    return to_csv(parsed)


def _build_json(parsed: ParsedStatement) -> bytes:
    from app.export.csv_json import to_json

    return to_json(parsed)


def _build_pdf(parsed: ParsedStatement) -> bytes:
    from app.export.pdf_summary import to_pdf_summary

    return to_pdf_summary(parsed)


def _build_sqlite(parsed: ParsedStatement) -> bytes:
    from app.export.sqlite_exporter import to_sqlite

    return to_sqlite(parsed)


# ---------------------------------------------------------------------- #
# Rehydration from stored JSON
# ---------------------------------------------------------------------- #
def rehydrate_parsed(data: dict[str, Any]) -> ParsedStatement:
    meta_d = data.get("meta", {})
    meta = StatementMeta(
        file_name=meta_d.get("file_name", ""),
        bank_name=meta_d.get("bank_name", ""),
        account_name=meta_d.get("account_name", ""),
        account_number=meta_d.get("account_number", ""),
        currency=meta_d.get("currency", "NGN"),
        period_start=_parse_date(meta_d.get("period_start")),
        period_end=_parse_date(meta_d.get("period_end")),
        page_count=meta_d.get("page_count", 0),
        extraction_method=meta_d.get("extraction_method", "text"),
        ocr_used=meta_d.get("ocr_used", False),
        total_pages_processed=meta_d.get("total_pages_processed", 0),
        parse_time_seconds=meta_d.get("parse_time_seconds", 0.0),
        source_file_hash=meta_d.get("source_file_hash", ""),
        bank_confidence=meta_d.get("bank_confidence", 0.0),
    )
    transactions = [_rehydrate_tx(t) for t in data.get("transactions", [])]
    validation = _rehydrate_validation(data.get("validation", {}))
    summary = _rehydrate_summary(data.get("summary", {}))
    return ParsedStatement(
        meta=meta,
        transactions=transactions,
        validation=validation,
        summary=summary,
        columns_detected=data.get("columns_detected", {}),
        raw_pages=[],
    )


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def _rehydrate_tx(t: dict[str, Any]) -> Transaction:
    return Transaction(
        tx_date=_parse_date(t.get("date")),
        value_date=_parse_date(t.get("value_date")),
        description=t.get("description", ""),
        reference=t.get("reference", ""),
        debit=t.get("debit"),
        credit=t.get("credit"),
        balance=t.get("balance"),
        currency=t.get("currency", "NGN"),
        branch=t.get("branch", ""),
        channel=t.get("channel", ""),
        instrument_number=t.get("instrument_number", ""),
        tx_type=t.get("transaction_type", "Unknown"),
        category=t.get("category", "Uncategorized"),
        page_number=t.get("page_number", 0),
        line_number=t.get("line_number", 0),
        is_beginning_balance=t.get("is_beginning_balance", False),
        is_ending_balance=t.get("is_ending_balance", False),
        is_estimated=t.get("is_estimated", False),
        ocr_confidence=t.get("ocr_confidence"),
        source_text=t.get("source_text", ""),
    )


def _rehydrate_validation(v: dict[str, Any]) -> ValidationReport:
    def issues(key: str) -> list[ValidationIssue]:
        return [_rehydrate_issue(i) for i in v.get(key, [])]

    return ValidationReport(
        missing_rows=issues("missing_rows"),
        balance_errors=issues("balance_errors"),
        duplicate_entries=issues("duplicate_entries"),
        unreadable_transactions=issues("unreadable_transactions"),
        other_issues=issues("other_issues"),
        ocr_confidence=v.get("ocr_confidence"),
        balance_reconciled=v.get("balance_reconciled", True),
        transaction_count_match=v.get("transaction_count_match", True),
    )


def _rehydrate_issue(i: dict[str, Any]) -> ValidationIssue:
    return ValidationIssue(
        issue_type=i.get("issue_type", ""),
        severity=i.get("severity", ""),
        message=i.get("message", ""),
        page_number=i.get("page_number"),
        line_number=i.get("line_number"),
        expected=i.get("expected"),
        actual=i.get("actual"),
        transaction_index=i.get("transaction_index"),
        suggested_fix=i.get("suggested_fix"),
    )


def _rehydrate_summary(s: dict[str, Any]) -> SummaryStats:
    return SummaryStats(
        opening_balance=s.get("opening_balance"),
        closing_balance=s.get("closing_balance"),
        total_credits=s.get("total_credits", 0.0),
        total_debits=s.get("total_debits", 0.0),
        number_of_transactions=s.get("number_of_transactions", 0),
        largest_debit=s.get("largest_debit"),
        largest_credit=s.get("largest_credit"),
        average_debit=s.get("average_debit"),
        average_credit=s.get("average_credit"),
        total_credit_count=s.get("total_credit_count", 0),
        total_debit_count=s.get("total_debit_count", 0),
        monthly_cash_flow=s.get("monthly_cash_flow", []),
        daily_cash_flow=s.get("daily_cash_flow", []),
        currency=s.get("currency", "NGN"),
    )
