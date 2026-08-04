"""Data models for Bank Statement Intelligence.

These are dependency-free dataclasses (and pydantic models where the FastAPI
layer needs serialisation). Pydantic is imported lazily in the API layer so
the core engine keeps a minimal dependency footprint.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import date, datetime
from enum import Enum
from typing import Any, Optional


class TransactionType(str, Enum):
    DEBIT = "Debit"
    CREDIT = "Credit"
    OPENING_BALANCE = "Opening Balance"
    CLOSING_BALANCE = "Closing Balance"
    UNKNOWN = "Unknown"


@dataclass
class Transaction:
    """A single extracted transaction record."""

    tx_date: Optional[date] = None
    value_date: Optional[date] = None
    description: str = ""
    reference: str = ""
    debit: Optional[float] = None
    credit: Optional[float] = None
    balance: Optional[float] = None
    currency: str = "NGN"
    branch: str = ""
    channel: str = ""
    instrument_number: str = ""
    tx_type: str = "Unknown"
    category: str = "Uncategorized"
    page_number: int = 0
    line_number: int = 0
    is_beginning_balance: bool = False
    is_ending_balance: bool = False
    is_estimated: bool = False
    ocr_confidence: Optional[float] = None
    source_text: str = ""

    def __post_init__(self) -> None:
        if not self.tx_type or self.tx_type == "Unknown":
            if self.debit is not None and self.credit is None:
                self.tx_type = "Debit"
            elif self.credit is not None and self.debit is None:
                self.tx_type = "Credit"
            elif self.is_beginning_balance:
                self.tx_type = "Opening Balance"

    @property
    def amount(self) -> Optional[float]:
        """Signed amount: negative for debits, positive for credits."""
        if self.debit is not None:
            return -abs(self.debit)
        if self.credit is not None:
            return abs(self.credit)
        return None

    def fingerprint(self) -> str:
        """Deterministic hash used for duplicate detection."""
        raw = "|".join(
            [
                str(self.tx_date or ""),
                str(self.value_date or ""),
                (self.description or "").lower().strip(),
                (self.reference or "").strip(),
                f"{self.debit or 0:.2f}",
                f"{self.credit or 0:.2f}",
                f"{self.balance or 0:.2f}",
            ]
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def to_dict(self) -> dict[str, Any]:
        return {
            "date": self.tx_date.isoformat() if self.tx_date else None,
            "value_date": self.value_date.isoformat() if self.value_date else None,
            "description": self.description,
            "reference": self.reference,
            "debit": self.debit,
            "credit": self.credit,
            "balance": self.balance,
            "currency": self.currency,
            "branch": self.branch,
            "channel": self.channel,
            "instrument_number": self.instrument_number,
            "transaction_type": self.tx_type,
            "category": self.category,
            "page_number": self.page_number,
            "line_number": self.line_number,
            "is_beginning_balance": self.is_beginning_balance,
            "is_ending_balance": self.is_ending_balance,
            "is_estimated": self.is_estimated,
            "ocr_confidence": self.ocr_confidence,
            "source_text": self.source_text,
            "amount": self.amount,
        }


@dataclass
class StatementMeta:
    """Metadata describing the parsed statement."""

    file_name: str = ""
    bank_name: str = ""
    account_name: str = ""
    account_number: str = ""
    currency: str = "NGN"
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    page_count: int = 0
    extraction_method: str = "text"
    ocr_used: bool = False
    total_pages_processed: int = 0
    parse_time_seconds: float = 0.0
    source_file_hash: str = ""
    bank_confidence: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_name": self.file_name,
            "bank_name": self.bank_name,
            "account_name": self.account_name,
            "account_number": self.account_number,
            "currency": self.currency,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "page_count": self.page_count,
            "extraction_method": self.extraction_method,
            "ocr_used": self.ocr_used,
            "total_pages_processed": self.total_pages_processed,
            "parse_time_seconds": self.parse_time_seconds,
            "source_file_hash": self.source_file_hash,
            "bank_confidence": self.bank_confidence,
        }


@dataclass
class ValidationIssue:
    issue_type: str
    severity: str
    message: str
    page_number: Optional[int] = None
    line_number: Optional[int] = None
    expected: Optional[float] = None
    actual: Optional[float] = None
    transaction_index: Optional[int] = None
    suggested_fix: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "issue_type": self.issue_type,
            "severity": self.severity,
            "message": self.message,
            "page_number": self.page_number,
            "line_number": self.line_number,
            "expected": self.expected,
            "actual": self.actual,
            "transaction_index": self.transaction_index,
            "suggested_fix": self.suggested_fix,
        }


@dataclass
class SummaryStats:
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    total_credits: float = 0.0
    total_debits: float = 0.0
    number_of_transactions: int = 0
    largest_debit: Optional[float] = None
    largest_credit: Optional[float] = None
    average_debit: Optional[float] = None
    average_credit: Optional[float] = None
    total_credit_count: int = 0
    total_debit_count: int = 0
    monthly_cash_flow: list[dict[str, Any]] = field(default_factory=list)
    daily_cash_flow: list[dict[str, Any]] = field(default_factory=list)
    currency: str = "NGN"

    def to_dict(self) -> dict[str, Any]:
        return {
            "opening_balance": self.opening_balance,
            "closing_balance": self.closing_balance,
            "total_credits": round(self.total_credits, 2),
            "total_debits": round(self.total_debits, 2),
            "number_of_transactions": self.number_of_transactions,
            "largest_debit": self.largest_debit,
            "largest_credit": self.largest_credit,
            "average_debit": round(self.average_debit, 2) if self.average_debit is not None else None,
            "average_credit": round(self.average_credit, 2) if self.average_credit is not None else None,
            "total_credit_count": self.total_credit_count,
            "total_debit_count": self.total_debit_count,
            "monthly_cash_flow": self.monthly_cash_flow,
            "daily_cash_flow": self.daily_cash_flow,
            "currency": self.currency,
        }


@dataclass
class Insight:
    """A single natural-language finding about the statement."""

    kind: str
    title: str
    message: str
    severity: str = "info"  # info | positive | warning
    metric_value: Optional[float] = None
    detail: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "title": self.title,
            "message": self.message,
            "severity": self.severity,
            "metric_value": self.metric_value,
            "detail": self.detail,
        }


@dataclass
class Anomaly:
    """A behavioural red flag worth a second look."""

    kind: str
    severity: str
    message: str
    page_number: Optional[int] = None
    line_number: Optional[int] = None
    transaction_index: Optional[int] = None
    amount: Optional[float] = None
    suggested_action: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "severity": self.severity,
            "message": self.message,
            "page_number": self.page_number,
            "line_number": self.line_number,
            "transaction_index": self.transaction_index,
            "amount": self.amount,
            "suggested_action": self.suggested_action,
        }


@dataclass
class ForecastMonth:
    month: str
    projected_balance: Optional[float] = None
    expected_income: float = 0.0
    expected_expense: float = 0.0
    at_risk: bool = False

    def to_dict(self) -> dict[str, Any]:
        return {
            "month": self.month,
            "projected_balance": self.projected_balance,
            "expected_income": self.expected_income,
            "expected_expense": self.expected_expense,
            "at_risk": self.at_risk,
        }


@dataclass
class Forecast:
    avg_monthly_income: float = 0.0
    avg_monthly_expense: float = 0.0
    months: list[ForecastMonth] = field(default_factory=list)
    summary: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "avg_monthly_income": self.avg_monthly_income,
            "avg_monthly_expense": self.avg_monthly_expense,
            "months": [m.to_dict() for m in self.months],
            "summary": self.summary,
        }


@dataclass
class InsightsReport:
    """Grouped analysis output for a parsed statement."""

    income: list[Insight] = field(default_factory=list)
    spending: list[Insight] = field(default_factory=list)
    recurring: list[Insight] = field(default_factory=list)
    anomalies: list[Anomaly] = field(default_factory=list)
    forecast: Optional[Forecast] = None

    @property
    def is_empty(self) -> bool:
        return not (self.income or self.spending or self.recurring or self.anomalies or self.forecast)

    def to_dict(self) -> dict[str, Any]:
        return {
            "income": [i.to_dict() for i in self.income],
            "spending": [i.to_dict() for i in self.spending],
            "recurring": [i.to_dict() for i in self.recurring],
            "anomalies": [a.to_dict() for a in self.anomalies],
            "forecast": self.forecast.to_dict() if self.forecast else None,
        }


@dataclass
class ValidationReport:
    missing_rows: list[ValidationIssue] = field(default_factory=list)
    balance_errors: list[ValidationIssue] = field(default_factory=list)
    duplicate_entries: list[ValidationIssue] = field(default_factory=list)
    unreadable_transactions: list[ValidationIssue] = field(default_factory=list)
    other_issues: list[ValidationIssue] = field(default_factory=list)
    ocr_confidence: Optional[float] = None
    balance_reconciled: bool = True
    transaction_count_match: bool = True

    @property
    def all_issues(self) -> list[ValidationIssue]:
        return (
            self.missing_rows
            + self.balance_errors
            + self.duplicate_entries
            + self.unreadable_transactions
            + self.other_issues
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "missing_rows": [i.to_dict() for i in self.missing_rows],
            "balance_errors": [i.to_dict() for i in self.balance_errors],
            "duplicate_entries": [i.to_dict() for i in self.duplicate_entries],
            "unreadable_transactions": [i.to_dict() for i in self.unreadable_transactions],
            "other_issues": [i.to_dict() for i in self.other_issues],
            "ocr_confidence": self.ocr_confidence,
            "balance_reconciled": self.balance_reconciled,
            "transaction_count_match": self.transaction_count_match,
            "total_issues": len(self.all_issues),
        }


@dataclass
class ParsedStatement:
    meta: StatementMeta
    transactions: list[Transaction]
    validation: ValidationReport
    summary: SummaryStats
    insights: InsightsReport = field(default_factory=InsightsReport)
    columns_detected: dict[str, Any] = field(default_factory=dict)
    raw_pages: list[Any] = field(default_factory=list)

    def to_dict(self, include_raw: bool = False) -> dict[str, Any]:
        return {
            "meta": {
                "file_name": self.meta.file_name,
                "bank_name": self.meta.bank_name,
                "account_name": self.meta.account_name,
                "account_number": self.meta.account_number,
                "currency": self.meta.currency,
                "period_start": self.meta.period_start.isoformat() if self.meta.period_start else None,
                "period_end": self.meta.period_end.isoformat() if self.meta.period_end else None,
                "page_count": self.meta.page_count,
                "extraction_method": self.meta.extraction_method,
                "ocr_used": self.meta.ocr_used,
                "total_pages_processed": self.meta.total_pages_processed,
                "parse_time_seconds": self.meta.parse_time_seconds,
                "bank_confidence": self.meta.bank_confidence,
            },
            "transactions": [t.to_dict() for t in self.transactions],
            "validation": self.validation.to_dict(),
            "summary": self.summary.to_dict(),
            "insights": self.insights.to_dict(),
            "columns_detected": self.columns_detected,
            "raw_pages": self.raw_pages if include_raw else [],
        }
