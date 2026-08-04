"""Natural-language spending & income insights computed from a parsed statement.

Every finding is structured (kind / title / message + optional metric) so the
frontend can render it as a card and a future LLM could paraphrase it. All
numbers are plain comma-formatted; currency context is provided by the caller.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Optional

from app.core.models import Insight, InsightsReport, StatementMeta, SummaryStats, Transaction

# Words that never identify a payee/merchant (category markers and generic
# noise). Reference tokens containing "/" and pure numbers are dropped too.
_NOISE = {
    "POS", "ATM", "TRF", "TRANSFER", "NIP", "INTRABANK", "INTERBANK", "INWARD",
    "OUTWARD", "PAYMENT", "PURCHASE", "WITHDRAWAL", "WITHDRAWALS", "CHARGE",
    "CHARGES", "BANK", "DEBIT", "CREDIT", "BALANCE", "THE", "FOR", "OF", "AND",
    "MOBILE", "MONEY", "RECEIVED", "PAID", "ON", "ACCT", "ACCOUNT", "REF", "BILL",
    "BILLPAYMENT", "AIRTIME", "DATA", "LOAN", "INTEREST", "COMMISSION", "VALUE",
    "DATE", "NARRATION", "DESCRIPTION", "CLOSING", "OPENING", "VIA", "TO",
    "FROM", "FUNDS", "CLEARING", "SUBSCRIPTION", "SERVICE",
}

SALARY_KEY = "SALARY"


def _payee_key(description: str) -> str:
    """Best-effort payee/merchant key extracted from a narration.

    Drops noise words, reference tokens and bare numbers, then returns the first
    remaining token (the brand/name). Empty string when nothing identifiable.
    """
    if not description:
        return ""
    kept: list[str] = []
    for token in description.upper().replace(",", " ").split():
        if "/" in token or token.isdigit() or token in _NOISE:
            continue
        kept.append(token)
    return kept[0] if kept else ""


def _fmt(value: float) -> str:
    return f"{value:,.2f}"


def _real_txs(transactions: list[Transaction]) -> list[Transaction]:
    return [t for t in transactions if not t.is_beginning_balance and not t.is_ending_balance]


def _income_insights(txs: list[Transaction], summary: SummaryStats) -> list[Insight]:
    out: list[Insight] = []
    total_credits = summary.total_credits
    if total_credits <= 0:
        return out

    by_source: dict[str, float] = defaultdict(float)
    for t in txs:
        if t.credit is not None:
            by_source[_payee_key(t.description)] += t.credit

    salary = by_source.get(SALARY_KEY, 0.0)
    if salary > 0:
        pct = salary / total_credits * 100
        out.append(
            Insight(
                kind="salary_share",
                title="Income composition",
                message=f"Salary payments account for {pct:.1f}% of your total income.",
                severity="positive",
                metric_value=round(pct, 1),
                detail=f"{_fmt(salary)} of {_fmt(total_credits)} total credits are salary.",
            )
        )

    named = {k: v for k, v in by_source.items() if k}
    if named:
        top_source, top_amount = max(named.items(), key=lambda kv: kv[1])
        if top_source != SALARY_KEY or not salary:
            pct = top_amount / total_credits * 100
            out.append(
                Insight(
                    kind="income_concentration",
                    title="Top income source",
                    message=f"{top_source.title()} is your largest income source at {_fmt(top_amount)}.",
                    severity="info",
                    metric_value=round(top_amount, 2),
                    detail=f"That is {pct:.0f}% of your {_fmt(total_credits)} total income.",
                )
            )
    return out


def _spending_insights(txs: list[Transaction], summary: SummaryStats) -> list[Insight]:
    out: list[Insight] = []

    by_category: dict[str, float] = defaultdict(float)
    atm_count = 0
    for t in txs:
        if t.debit is None:
            continue
        by_category[t.category or "Other"] += t.debit
        if t.category == "ATM":
            atm_count += 1

    if by_category:
        ranked = sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)
        top_cats = ", ".join(f"{cat} ({_fmt(amt)})" for cat, amt in ranked[:3])
        out.append(
            Insight(
                kind="top_categories",
                title="Top spending categories",
                message=f"Most of your spending goes to: {top_cats}.",
                severity="info",
                metric_value=round(ranked[0][1], 2),
                detail="\n".join(f"{cat}: {_fmt(amt)}" for cat, amt in ranked[:5]),
            )
        )

    if atm_count:
        out.append(
            Insight(
                kind="atm_usage",
                title="Cash withdrawals",
                message=f"There were {atm_count} ATM withdrawals in this period.",
                severity="info",
                metric_value=float(atm_count),
            )
        )

    if summary.largest_debit is not None:
        out.append(
            Insight(
                kind="largest_debit",
                title="Largest outgoing payment",
                message=f"Your largest debit was {_fmt(summary.largest_debit)}.",
                severity="info",
                metric_value=round(summary.largest_debit, 2),
            )
        )
    if summary.largest_credit is not None:
        out.append(
            Insight(
                kind="largest_credit",
                title="Largest incoming payment",
                message=f"Your largest credit was {_fmt(summary.largest_credit)}.",
                severity="positive",
                metric_value=round(summary.largest_credit, 2),
            )
        )

    flow = [m for m in summary.monthly_cash_flow if (m.get("debits") or 0) > 0]
    if len(flow) >= 2:
        prev, last = flow[-2]["debits"], flow[-1]["debits"]
        if prev > 0:
            delta = (last - prev) / prev * 100
            if abs(delta) >= 10:
                direction = "increased" if delta > 0 else "decreased"
                out.append(
                    Insight(
                        kind="month_over_month",
                        title="Spending trend",
                        message=(
                            f"Your spending {direction} by {abs(delta):.0f}% "
                            f"({_fmt(last)}) compared with the previous month ({_fmt(prev)})."
                        ),
                        severity="warning" if delta > 0 else "positive",
                        metric_value=round(delta, 1),
                    )
                )
    return out


def _recurring_insights(txs: list[Transaction]) -> list[Insight]:
    """Same payee + same amount appearing in 2+ distinct months => recurring."""
    out: list[Insight] = []
    by_pair: dict[tuple[str, float], set[str]] = defaultdict(set)
    for t in txs:
        if t.debit is None or t.tx_date is None:
            continue
        payee = _payee_key(t.description)
        if not payee:
            continue
        by_pair[(payee, round(t.debit, 2))].add(t.tx_date.strftime("%Y-%m"))

    recurring = [
        (payee, amount)
        for (payee, amount), months in by_pair.items()
        if len(months) >= 2
    ]
    if not recurring:
        return out
    recurring.sort(key=lambda kv: kv[1], reverse=True)
    monthly_total = sum(amount for _, amount in recurring)
    top = recurring[:5]
    out.append(
        Insight(
            kind="recurring_payments",
            title="Recurring payments",
            message=(
                f"You have {len(recurring)} recurring charge{'s' if len(recurring) != 1 else ''} "
                f"totalling about {_fmt(monthly_total)} each month."
            ),
            severity="info",
            metric_value=round(monthly_total, 2),
            detail="\n".join(f"{payee.title()}: {_fmt(amount)}/month" for payee, amount in top),
        )
    )
    return out


def generate_insights(
    transactions: list[Transaction],
    summary: SummaryStats,
    meta: Optional[StatementMeta] = None,  # noqa: ARG001 (reserved for LLM tier)
) -> InsightsReport:
    txs = _real_txs(transactions)
    if not txs or (summary.total_credits <= 0 and summary.total_debits <= 0):
        return InsightsReport()
    return InsightsReport(
        income=_income_insights(txs, summary),
        spending=_spending_insights(txs, summary),
        recurring=_recurring_insights(txs),
    )
