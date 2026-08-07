"""Account-head (chart of accounts) breakdown of a parsed statement.

Aggregates categorised transactions into account heads — the same buckets an
accountant would use for a chart of accounts — so every transaction is sliced
into heads like Salary, Rent & Accommodation, Utility Bills, Bank Charges, etc.
"""

from __future__ import annotations

from app.core.models import AccountHead, Transaction


def compute_account_heads(transactions: list[Transaction]) -> list[AccountHead]:
    """Aggregate transactions into account heads, largest turnover first."""
    heads: dict[str, AccountHead] = {}
    for t in transactions:
        if t.is_beginning_balance or t.is_ending_balance:
            continue
        name = (t.category or "Other").strip() or "Other"
        head = heads.get(name)
        if head is None:
            head = heads[name] = AccountHead(name=name)
        head.transaction_count += 1
        if t.debit is not None:
            head.debit_total += t.debit
        if t.credit is not None:
            head.credit_total += t.credit

    for head in heads.values():
        head.debit_total = round(head.debit_total, 2)
        head.credit_total = round(head.credit_total, 2)

    return sorted(
        heads.values(),
        key=lambda h: (h.debit_total + h.credit_total, h.transaction_count),
        reverse=True,
    )
