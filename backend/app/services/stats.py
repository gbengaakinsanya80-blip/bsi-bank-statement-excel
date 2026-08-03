"""Summary statistics and cash-flow aggregation for parsed statements."""

from __future__ import annotations

from collections import defaultdict

from app.core.models import SummaryStats, Transaction


def compute_summary(transactions: list[Transaction], currency: str = "NGN") -> SummaryStats:
    stats = SummaryStats(currency=currency)

    txs = [t for t in transactions if not t.is_beginning_balance and not t.is_ending_balance]

    opening = next((t.balance for t in transactions if t.is_beginning_balance), None)
    closing = next((t.balance for t in transactions if t.is_ending_balance), None)
    if closing is None and txs and txs[-1].balance is not None:
        closing = txs[-1].balance

    stats.opening_balance = opening
    stats.closing_balance = closing

    total_credit = 0.0
    total_debit = 0.0
    credit_count = 0
    debit_count = 0
    largest_debit: float | None = None
    largest_credit: float | None = None

    monthly: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])
    daily: dict[str, list[float]] = defaultdict(lambda: [0.0, 0.0])

    for t in txs:
        if t.credit is not None:
            total_credit += t.credit
            credit_count += 1
            largest_credit = max(largest_credit or 0.0, t.credit)
        if t.debit is not None:
            total_debit += t.debit
            debit_count += 1
            largest_debit = max(largest_debit or 0.0, t.debit)

        if t.tx_date is not None:
            key_m = t.tx_date.strftime("%Y-%m")
            key_d = t.tx_date.isoformat()
            monthly[key_m][0] += t.credit or 0.0
            monthly[key_m][1] += t.debit or 0.0
            daily[key_d][0] += t.credit or 0.0
            daily[key_d][1] += t.debit or 0.0

    stats.total_credits = round(total_credit, 2)
    stats.total_debits = round(total_debit, 2)
    stats.number_of_transactions = len(txs)
    stats.largest_debit = largest_debit
    stats.largest_credit = largest_credit
    stats.average_debit = round(total_debit / debit_count, 2) if debit_count else None
    stats.average_credit = round(total_credit / credit_count, 2) if credit_count else None
    stats.total_debit_count = debit_count
    stats.total_credit_count = credit_count

    stats.monthly_cash_flow = [
        {
            "month": key,
            "credits": round(v[0], 2),
            "debits": round(v[1], 2),
            "net": round(v[0] - v[1], 2),
        }
        for key, v in sorted(monthly.items())
    ]
    stats.daily_cash_flow = [
        {"date": key, "credits": round(v[0], 2), "debits": round(v[1], 2)}
        for key, v in sorted(daily.items())
    ]
    return stats
