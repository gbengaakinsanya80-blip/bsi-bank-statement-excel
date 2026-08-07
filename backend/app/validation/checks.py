"""Integrity validation: running balance, opening/closing reconciliation,
duplicates, missing rows, unreadable transactions."""

from __future__ import annotations

from typing import Optional

from app.core.models import (
    SummaryStats,
    Transaction,
    ValidationIssue,
    ValidationReport,
)


def validate_statement(
    transactions: list[Transaction],
    summary: SummaryStats,
    ocr_confidence: Optional[float] = None,
) -> ValidationReport:
    report = ValidationReport(ocr_confidence=ocr_confidence)

    _check_running_balance(transactions, report)
    _check_reconciliation(transactions, summary, report)
    _check_duplicates(transactions, report)
    _check_unreadable(transactions, report)
    _check_missing(transactions, report)

    return report


def _check_running_balance(
    transactions: list[Transaction], report: ValidationReport
) -> None:
    prev: Optional[float] = None
    for i, t in enumerate(transactions):
        if t.is_beginning_balance:
            prev = t.balance
            continue
        if t.is_ending_balance:
            continue
        if t.balance is not None and prev is not None:
            expected = (prev or 0.0) + (t.credit or 0.0) - (t.debit or 0.0)
            if abs(expected - t.balance) > 0.01:
                report.balance_errors.append(
                    ValidationIssue(
                        issue_type="running_balance",
                        severity="error",
                        message=(
                            f"Running balance mismatch at line {t.line_number}: "
                            f"expected {expected:.2f} but statement shows {t.balance:.2f}"
                        ),
                        page_number=t.page_number,
                        line_number=t.line_number,
                        expected=round(expected, 2),
                        actual=round(t.balance, 2),
                        transaction_index=i,
                        suggested_fix="Possible missing or duplicate transaction; verify manually.",
                    )
                )
        if t.balance is not None:
            prev = t.balance
        elif t.credit is not None or t.debit is not None:
            prev = (prev or 0.0) + (t.credit or 0.0) - (t.debit or 0.0)


def _check_reconciliation(
    transactions: list[Transaction], summary: SummaryStats, report: ValidationReport
) -> None:
    opening = summary.opening_balance
    closing = summary.closing_balance
    if opening is None or closing is None:
        report.other_issues.append(
            ValidationIssue(
                issue_type="reconciliation",
                severity="warning",
                message="Cannot reconcile: opening or closing balance not detected.",
            )
        )
        return
    expected = opening + summary.total_credits - summary.total_debits
    if abs(expected - closing) > 0.01:
        report.balance_reconciled = False
        report.other_issues.append(
            ValidationIssue(
                issue_type="reconciliation",
                severity="error",
                message=(
                    f"Opening {opening:.2f} + credits {summary.total_credits:.2f} "
                    f"- debits {summary.total_debits:.2f} = {expected:.2f} but "
                    f"closing balance is {closing:.2f}."
                ),
                expected=round(expected, 2),
                actual=round(closing, 2),
                suggested_fix="A transaction may have been skipped or mis-parsed.",
            )
        )


def _check_duplicates(
    transactions: list[Transaction], report: ValidationReport
) -> None:
    seen: dict[str, int] = {}
    for i, t in enumerate(transactions):
        if t.is_beginning_balance or t.is_ending_balance:
            continue
        fp = t.fingerprint()
        if fp in seen:
            report.duplicate_entries.append(
                ValidationIssue(
                    issue_type="duplicate",
                    severity="warning",
                    message=(
                        f"Duplicate transaction at line {t.line_number} matches "
                        f"line {seen[fp]}."
                    ),
                    page_number=t.page_number,
                    line_number=t.line_number,
                    transaction_index=i,
                    suggested_fix="Remove the duplicated row.",
                )
            )
        else:
            seen[fp] = t.line_number


def _check_unreadable(
    transactions: list[Transaction], report: ValidationReport
) -> None:
    for i, t in enumerate(transactions):
        if t.is_beginning_balance or t.is_ending_balance:
            continue
        if t.tx_date is None:
            report.unreadable_transactions.append(
                ValidationIssue(
                    issue_type="missing_date",
                    severity="warning",
                    message=f"Transaction at line {t.line_number} has no date.",
                    page_number=t.page_number,
                    line_number=t.line_number,
                    transaction_index=i,
                )
            )
        if t.debit is None and t.credit is None:
            report.unreadable_transactions.append(
                ValidationIssue(
                    issue_type="missing_amount",
                    severity="warning",
                    message=f"Transaction at line {t.line_number} has no amount.",
                    page_number=t.page_number,
                    line_number=t.line_number,
                    transaction_index=i,
                    suggested_fix="The row may be unreadable or misaligned.",
                )
            )


def _check_missing(
    transactions: list[Transaction], report: ValidationReport
) -> None:
    # A large unexplained balance jump that is not a running-balance error
    # strongly suggests a skipped transaction row.
    prev: Optional[float] = None
    for i, t in enumerate(transactions):
        if t.is_beginning_balance:
            prev = t.balance
            continue
        if t.is_ending_balance:
            continue
        if t.balance is not None and prev is not None:
            expected = (prev or 0.0) + (t.credit or 0.0) - (t.debit or 0.0)
            if abs(expected - t.balance) > 0.01 and (t.credit is None and t.debit is None):
                report.missing_rows.append(
                    ValidationIssue(
                        issue_type="missing_row",
                        severity="error",
                        message=(
                            f"Balance jumped by {abs(t.balance - prev):.2f} at "
                            f"line {t.line_number} without a matching amount."
                        ),
                        page_number=t.page_number,
                        line_number=t.line_number,
                        expected=round(expected, 2),
                        actual=round(t.balance, 2),
                        transaction_index=i,
                        suggested_fix="A transaction row may have been skipped.",
                    )
                )
        if t.balance is not None:
            prev = t.balance
        elif t.credit is not None or t.debit is not None:
            prev = (prev or 0.0) + (t.credit or 0.0) - (t.debit or 0.0)

    report.transaction_count_match = len(report.missing_rows) == 0
