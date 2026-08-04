"""Processing pipeline: run the extraction engine, save artifacts and
rehydrate stored results so exports survive restarts."""

from __future__ import annotations

import json
from datetime import date
from typing import Any, Callable, Optional

from app.core.models import (
    Anomaly,
    Forecast,
    ForecastMonth,
    Insight,
    InsightsReport,
    ParsedStatement,
    StatementMeta,
    SummaryStats,
    TaxSummary,
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
        progress_cb(97.0, "Analysing")
    _attach_insights(parsed)
    if progress_cb is not None:
        progress_cb(99.0, "Finalising")
    return parsed


def _attach_insights(parsed: ParsedStatement) -> None:
    from app.analysis.anomalies import detect_anomalies
    from app.analysis.forecast import forecast_cashflow
    from app.analysis.insights import generate_insights
    from app.analysis.tax import estimate_tax

    report = generate_insights(parsed.transactions, parsed.summary, parsed.meta)
    report.anomalies = detect_anomalies(parsed.transactions, parsed.summary)
    report.forecast = forecast_cashflow(parsed.transactions, parsed.summary)
    report.tax = estimate_tax(parsed.transactions, parsed.summary)
    parsed.insights = report


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
        insights=_rehydrate_insights(data.get("insights", {})),
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


def _rehydrate_insights(d: dict[str, Any]) -> InsightsReport:
    if not d:
        return InsightsReport()
    return InsightsReport(
        income=[_rehydrate_insight(i) for i in d.get("income", [])],
        spending=[_rehydrate_insight(i) for i in d.get("spending", [])],
        recurring=[_rehydrate_insight(i) for i in d.get("recurring", [])],
        anomalies=[_rehydrate_anomaly(a) for a in d.get("anomalies", [])],
        forecast=_rehydrate_forecast(d.get("forecast")),
        tax=_rehydrate_tax(d.get("tax")),
    )


def _rehydrate_tax(t: Any) -> Optional[TaxSummary]:
    if not t:
        return None
    return TaxSummary(
        business_expenses=t.get("business_expenses", 0.0),
        deductible_estimate=t.get("deductible_estimate", 0.0),
        vat_estimate=t.get("vat_estimate", 0.0),
        business_category_breakdown=t.get("business_category_breakdown", {}),
        notes=t.get("notes", []),
    )


def _rehydrate_insight(i: dict[str, Any]) -> Insight:
    return Insight(
        kind=i.get("kind", ""),
        title=i.get("title", ""),
        message=i.get("message", ""),
        severity=i.get("severity", "info"),
        metric_value=i.get("metric_value"),
        detail=i.get("detail"),
    )


def _rehydrate_anomaly(a: dict[str, Any]) -> Anomaly:
    return Anomaly(
        kind=a.get("kind", ""),
        severity=a.get("severity", "warning"),
        message=a.get("message", ""),
        page_number=a.get("page_number"),
        line_number=a.get("line_number"),
        transaction_index=a.get("transaction_index"),
        amount=a.get("amount"),
        suggested_action=a.get("suggested_action"),
    )


def _rehydrate_forecast(f: Any) -> Optional[Forecast]:
    if not f:
        return None
    return Forecast(
        avg_monthly_income=f.get("avg_monthly_income", 0.0),
        avg_monthly_expense=f.get("avg_monthly_expense", 0.0),
        months=[_rehydrate_forecast_month(m) for m in f.get("months", [])],
        summary=f.get("summary", ""),
    )


def _rehydrate_forecast_month(m: dict[str, Any]) -> ForecastMonth:
    return ForecastMonth(
        month=m.get("month", ""),
        projected_balance=m.get("projected_balance"),
        expected_income=m.get("expected_income", 0.0),
        expected_expense=m.get("expected_expense", 0.0),
        at_risk=m.get("at_risk", False),
    )
