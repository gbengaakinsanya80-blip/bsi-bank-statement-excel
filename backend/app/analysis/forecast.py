"""Simple cash-flow forecast built from monthly averages.

Uses the months present in the statement to estimate average income and expense,
then projects the balance forward a few months and flags months at risk of a
shortage. Deterministic and rule-based; no probabilistic modelling.
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.core.models import Forecast, ForecastMonth, SummaryStats, Transaction


def _fmt(value: float) -> str:
    return f"{value:,.2f}"


def _next_months(start: date, count: int) -> list[date]:
    months: list[date] = []
    year, month = start.year, start.month
    for _ in range(count):
        month += 1
        if month > 12:
            month = 1
            year += 1
        months.append(date(year, month, 1))
    return months


def forecast_cashflow(
    transactions: list[Transaction],  # noqa: ARG001 (used for future models)
    summary: SummaryStats,
    months_ahead: int = 3,
) -> Forecast:
    flows = summary.monthly_cash_flow or []
    income = [m.get("credits") or 0.0 for m in flows if (m.get("credits") or 0) > 0]
    expense = [m.get("debits") or 0.0 for m in flows if (m.get("debits") or 0) > 0]

    avg_income = round(sum(income) / len(income), 2) if income else 0.0
    avg_expense = round(sum(expense) / len(expense), 2) if expense else 0.0

    last_balance = summary.closing_balance
    base = round(last_balance or 0.0, 2)

    start = date.today()
    if flows:
        last_month = max(m["month"] for m in flows)
        try:
            year, month = (int(p) for p in last_month.split("-"))
            start = date(year, month, 1)
        except (ValueError, KeyError):
            start = date.today()

    months: list[ForecastMonth] = []
    for d in _next_months(start, max(1, min(months_ahead, 12))):
        net = round(avg_income - avg_expense, 2)
        base = round(base + net, 2)
        at_risk = base < 0 or (
            last_balance is not None and last_balance > 0 and base < last_balance * 0.2
        )
        months.append(
            ForecastMonth(
                month=d.strftime("%Y-%m"),
                projected_balance=round(base, 2),
                expected_income=avg_income,
                expected_expense=avg_expense,
                at_risk=at_risk,
            )
        )

    risked = [m for m in months if m.at_risk]
    if avg_income <= 0 and avg_expense <= 0:
        summary_text = (
            "Not enough monthly data to forecast reliably; "
            "a longer statement period would improve the estimate."
        )
    elif risked:
        summary_text = (
            f"With average monthly income of {_fmt(avg_income)} and expenses of "
            f"{_fmt(avg_expense)}, your balance is projected to dip below safe "
            f"levels in {', '.join(m.month for m in risked)}."
        )
    else:
        summary_text = (
            f"With average monthly income of {_fmt(avg_income)} and expenses of "
            f"{_fmt(avg_expense)}, your projected balance stays positive for the "
            f"next {len(months)} month{'s' if len(months) != 1 else ''}."
        )

    return Forecast(
        avg_monthly_income=avg_income,
        avg_monthly_expense=avg_expense,
        months=months,
        summary=summary_text,
    )
