"""Tests for the account-head (chart of accounts) breakdown."""

from __future__ import annotations

from app.analysis.account_heads import compute_account_heads
from app.core.models import Transaction


def _tx(desc: str = "", debit: float | None = None, credit: float | None = None,
        category: str = "Other", opening: bool = False, closing: bool = False) -> Transaction:
    return Transaction(
        description=desc,
        debit=debit,
        credit=credit,
        category=category,
        is_beginning_balance=opening,
        is_ending_balance=closing,
    )


def test_aggregates_by_category_and_totals() -> None:
    txs = [
        _tx("A", debit=100, category="Rent & Accommodation"),
        _tx("B", debit=50, category="Rent & Accommodation"),
        _tx("C", credit=300, category="Customer Receipts"),
        _tx("D", credit=40, category="Customer Receipts"),
    ]
    heads = compute_account_heads(txs)
    by_name = {h.name: h for h in heads}

    rent = by_name["Rent & Accommodation"]
    assert rent.transaction_count == 2
    assert rent.debit_total == 150
    assert rent.credit_total == 0
    assert rent.net == -150

    cust = by_name["Customer Receipts"]
    assert cust.transaction_count == 2
    assert cust.debit_total == 0
    assert cust.credit_total == 340
    assert cust.net == 340


def test_skips_opening_and_closing_balance_rows() -> None:
    txs = [
        _tx("OPENING BALANCE", credit=5000, opening=True),
        _tx("POS SHOPRITE", debit=120, category="POS"),
        _tx("CLOSING BALANCE", credit=4880, closing=True),
    ]
    heads = compute_account_heads(txs)
    assert [h.name for h in heads] == ["POS"]
    assert heads[0].debit_total == 120


def test_sorted_by_turnover_desc() -> None:
    txs = [
        _tx(debit=1000, category="Bills"),
        _tx(credit=500, category="Charges"),
        _tx(debit=9000, category="Salary"),
    ]
    heads = compute_account_heads(txs)
    assert [h.name for h in heads] == ["Salary", "Bills", "Charges"]


def test_unknown_category_rolls_into_other() -> None:
    txs = [_tx(debit=10, category=""), _tx(debit=20, category=None)]
    heads = compute_account_heads(txs)
    assert len(heads) == 1
    assert heads[0].name == "Other"
    assert heads[0].transaction_count == 2


def test_empty_transactions_return_empty() -> None:
    assert compute_account_heads([]) == []
