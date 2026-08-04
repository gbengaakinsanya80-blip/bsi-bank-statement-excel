"""Rule-based anomaly detection complementing the integrity validator.

Flags behavioural patterns that often deserve a second look (large, unusual
withdrawals; rapid transfers to the same beneficiary; large round-number cash
withdrawals) without raising false alarms on legitimate everyday activity.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Optional

from app.core.models import Anomaly, SummaryStats, Transaction

from .insights import _payee_key


def _fmt(value: float) -> str:
    return f"{value:,.2f}"


def _real_txs(transactions: list[Transaction]) -> list[Transaction]:
    return [
        t
        for t in transactions
        if not t.is_beginning_balance
        and not t.is_ending_balance
        and not t.is_estimated
        and (t.debit is not None or t.credit is not None)
    ]


def _large_withdrawals(txs: list[Transaction]) -> list[Anomaly]:
    debits = [t.debit for t in txs if t.debit is not None]
    if not debits:
        return []
    average = sum(debits) / len(debits)
    if average <= 0:
        return []
    out: list[Anomaly] = []
    for i, t in enumerate(txs):
        if t.debit is not None and t.debit >= 3 * average and t.debit >= 50_000:
            out.append(
                Anomaly(
                    kind="large_withdrawal",
                    severity="warning",
                    message=(
                        f"Withdrawal of {_fmt(t.debit)} at line {t.line_number} is "
                        f"about 3x your average debit of {_fmt(average)}."
                    ),
                    page_number=t.page_number,
                    line_number=t.line_number,
                    transaction_index=i,
                    amount=round(t.debit, 2),
                    suggested_action="Confirm this large payment is expected.",
                )
            )
    return out


def _rapid_transfers(txs: list[Transaction]) -> list[Anomaly]:
    groups: dict[str, list[tuple[date, Transaction, int]]] = defaultdict(list)
    for i, t in enumerate(txs):
        if t.debit is None or t.tx_date is None:
            continue
        payee = _payee_key(t.description)
        if payee:
            groups[payee].append((t.tx_date, t, i))

    out: list[Anomaly] = []
    for payee, entries in groups.items():
        entries.sort(key=lambda e: e[0])
        for i in range(len(entries)):
            window = [e for e in entries if (e[0] - entries[i][0]).days <= 7]
            if len(window) >= 3:
                total = sum(e[1].debit or 0.0 for e in window)
                if total >= 200_000:
                    out.append(
                        Anomaly(
                            kind="rapid_transfers",
                            severity="warning",
                            message=(
                                f"{len(window)} payments to {payee.title()} within 7 days "
                                f"totalling {_fmt(total)}."
                            ),
                            page_number=window[0][1].page_number,
                            line_number=window[0][1].line_number,
                            transaction_index=window[0][2],
                            amount=round(total, 2),
                            suggested_action="Verify these transfers are all intended.",
                        )
                    )
                break
    return out


def _round_number_cash(txs: list[Transaction]) -> list[Anomaly]:
    """Repeated large round-number ATM cash withdrawals."""
    out: list[Anomaly] = []
    cash = [
        (i, t)
        for i, t in enumerate(txs)
        if t.category == "ATM"
        and t.debit is not None
        and t.debit % 5_000 == 0
        and t.debit >= 200_000
    ]
    if len(cash) >= 2:
        total = sum(t.debit or 0.0 for _, t in cash)
        first_index, first = cash[0]
        out.append(
            Anomaly(
                kind="round_number_cash",
                severity="warning",
                message=(
                    f"{len(cash)} large round-number ATM withdrawals totalling {_fmt(total)}."
                ),
                page_number=first.page_number,
                line_number=first.line_number,
                transaction_index=first_index,
                amount=round(total, 2),
                suggested_action="Large cash withdrawals may warrant extra scrutiny.",
            )
        )
    return out


def detect_anomalies(
    transactions: list[Transaction],
    summary: Optional[SummaryStats] = None,  # noqa: ARG001 (reserved)
) -> list[Anomaly]:
    txs = _real_txs(transactions)
    if not txs:
        return []
    return (
        _large_withdrawals(txs)
        + _rapid_transfers(txs)
        + _round_number_cash(txs)
    )
