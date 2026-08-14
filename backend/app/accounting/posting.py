"""Posting engine: journals, trial balance and adjustments (PRD sections 33-36).

Approved classifications become double-entry journal entries against the bank
account (1010) and the classified chart-of-accounts code. Posting is
idempotent: only ledger transactions still in the ``applied`` state are
posted, and each posting flips the row to ``posted``. The trial balance is
derived straight from journal lines, and manual adjusting entries follow the
same double-entry rules behind an explicit approval step.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from app.accounting import audit
from app.accounting.coa import BANK_ACCOUNT_CODES

BANK_CODE = "1010"
SUSPENSE_CODE = "1200"

ADJUSTMENT_TYPES = ("manual", "accrual", "correction", "other")


def post_applied_transactions(
    store,
    *,
    company_id: str,
    user_id: str,
    period_id: Optional[str] = None,
    statement_id: Optional[str] = None,
) -> dict:
    """Post every ``applied`` ledger transaction as a balanced journal entry.

    Returns a summary; rows already posted, in review, or attached to a locked
    period are skipped. Idempotent by construction.
    """
    if period_id:
        period = store.get_period(period_id, company_id)
        if period is None:
            raise KeyError("Accounting period not found.")
        if period["status"] == "locked":
            raise ValueError("Cannot post into a locked accounting period.")

    txns = store.list_ledger_transactions(company_id, status="applied", limit=1000000)
    posted = 0
    skipped = 0
    journal_ids: list[str] = []
    for txn in txns:
        if statement_id and txn.get("statement_id") != statement_id:
            skipped += 1
            continue
        txn_period = _txn_period(store, company_id, txn)
        if period_id is not None and txn_period != period_id:
            skipped += 1
            continue
        if txn_period:
            period = store.get_period(txn_period, company_id)
            if period is None or period["status"] == "locked":
                skipped += 1
                continue
        try:
            entry = _post_transaction(
                store, company_id=company_id, user_id=user_id, txn=txn, period_id=txn_period
            )
        except ValueError:
            skipped += 1
            continue
        posted += 1
        journal_ids.append(entry["id"])
        store.update_ledger_transaction(txn["id"], company_id, status="posted")

    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="posting.run",
        entity="ledger_transactions",
        entity_id=company_id,
        new_value={"posted": posted, "skipped": skipped, "journal_ids": journal_ids},
    )
    return {"posted": posted, "skipped": skipped, "journal_ids": journal_ids}


def trial_balance(store, *, company_id: str, period_id: Optional[str] = None) -> dict:
    """Return per-account debit/credit totals and whether the books balance."""
    rows = store.trial_balance(company_id, period_id=period_id)
    accounts: list[dict[str, Any]] = []
    total_debit = total_credit = 0.0
    for row in rows:
        dr = round(float(row.get("total_debit") or 0), 2)
        cr = round(float(row.get("total_credit") or 0), 2)
        total_debit += dr
        total_credit += cr
        net = round(dr - cr, 2)
        accounts.append(
            {
                **row,
                "balance": abs(net),
                "balance_side": "debit" if net >= 0 else "credit",
            }
        )
    return {
        "accounts": accounts,
        "total_debit": round(total_debit, 2),
        "total_credit": round(total_credit, 2),
        "balanced": round(total_debit - total_credit, 2) == 0.0,
    }


def create_adjustment(
    store,
    *,
    company_id: str,
    user_id: str,
    period_id: Optional[str] = None,
    adj_type: str = "manual",
    description: str = "",
    amount: float = 0.0,
) -> dict:
    """Draft a manual adjusting entry (still needs approval)."""
    if adj_type not in ADJUSTMENT_TYPES:
        raise ValueError(f"adj_type must be one of {ADJUSTMENT_TYPES}.")
    amount = round(float(amount or 0), 2)
    if amount <= 0:
        raise ValueError("Adjustment amount must be positive.")
    if period_id:
        period = store.get_period(period_id, company_id)
        if period is None:
            raise KeyError("Accounting period not found.")
        if period["status"] == "locked":
            raise ValueError("Cannot create an adjustment in a locked period.")
    adjustment = store.create_adjustment(
        company_id,
        period_id=period_id,
        adj_type=adj_type,
        description=(description or "Adjusting entry")[:200],
        amount=amount,
    )
    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="adjustment.created",
        entity="adjustments",
        entity_id=adjustment["id"],
        new_value={"adj_type": adj_type, "amount": amount, "period_id": period_id},
    )
    return adjustment


def approve_adjustment(
    store,
    *,
    company_id: str,
    user_id: str,
    adj_id: str,
    debit_code: str,
    credit_code: str,
    date: Optional[str] = None,
) -> dict:
    """Approve a draft adjustment and post it as a balanced journal entry."""
    adjustment = store.get_adjustment(adj_id, company_id)
    if adjustment is None:
        raise KeyError("Adjustment not found.")
    if adjustment.get("approved_by"):
        raise ValueError("Adjustment has already been approved.")
    if adjustment.get("journal_id"):
        raise ValueError("Adjustment has already been posted.")
    amount = round(float(adjustment.get("amount") or 0), 2)
    if amount <= 0:
        raise ValueError("Adjustment amount must be positive.")
    codes = {str(a["code"]) for a in store.list_chart_of_accounts(company_id)}
    if debit_code not in codes or credit_code not in codes:
        raise ValueError("debit_code and credit_code must exist in the chart of accounts.")
    if debit_code == credit_code:
        raise ValueError("debit_code and credit_code must differ.")
    period_id = adjustment.get("period_id")
    if period_id:
        period = store.get_period(period_id, company_id)
        if period and period["status"] == "locked":
            raise ValueError("Cannot post an adjustment into a locked period.")
    tx_date = date or adjustment.get("created_at", "")[:10] or _today()
    entry = store.create_journal_entry(
        company_id,
        period_id=period_id,
        journal_no=next_journal_no(store, company_id),
        tx_date=tx_date,
        reference=f"ADJ-{adj_id[:8]}",
        description=(adjustment.get("description") or "Adjusting entry")[:200],
        status="posted",
        source_type="adjustment",
        source_id=adj_id,
        created_by=user_id,
        lines=[
            {"account_code": debit_code, "debit": amount, "credit": 0},
            {"account_code": credit_code, "debit": 0, "credit": amount},
        ],
    )
    store.update_adjustment(adj_id, company_id, approved_by=user_id, journal_id=entry["id"])
    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="adjustment.posted",
        entity="adjustments",
        entity_id=adj_id,
        new_value={
            "debit_code": debit_code,
            "credit_code": credit_code,
            "amount": amount,
            "journal_id": entry["id"],
        },
    )
    return entry


def unpost_journal(
    store,
    *,
    company_id: str,
    user_id: str,
    journal_id: str,
    reason: Optional[str] = None,
) -> dict:
    """Delete a journal and return its source transaction to ``applied``."""
    entry = store.get_journal_entry(journal_id, company_id)
    if entry is None:
        raise KeyError("Journal entry not found.")
    source_type = entry.get("source_type")
    source_id = entry.get("source_id")
    if not store.delete_journal(journal_id, company_id):
        raise KeyError("Journal entry not found.")
    if source_type == "bank_statement" and source_id:
        store.update_ledger_transaction(source_id, company_id, status="applied")
    elif source_type == "adjustment" and source_id:
        store.update_adjustment(source_id, company_id, approved_by=None, journal_id=None)
    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="journal.unposted",
        entity="journal_entries",
        entity_id=journal_id,
        reason=reason,
    )
    return {"unposted": journal_id, "journal_no": entry.get("journal_no")}


def next_journal_no(store, company_id: str) -> str:
    latest = store.latest_journal_no(company_id)
    seq = 1
    if latest and "-" in str(latest):
        try:
            seq = int(str(latest).rsplit("-", 1)[1]) + 1
        except ValueError:
            seq = 1
    return f"JRNL-{datetime.now(timezone.utc).strftime('%Y%m')}-{seq:04d}"


def _post_transaction(store, *, company_id: str, user_id: str, txn: dict, period_id: Optional[str]) -> dict:
    amount = _txn_amount(txn)
    if amount <= 0:
        raise ValueError("Transaction has no amount to post.")
    account_code = str(txn.get("account_code") or SUSPENSE_CODE)
    if account_code in BANK_ACCOUNT_CODES:
        account_code = SUSPENSE_CODE
    if txn.get("transaction_type") == "opening_balance":
        lines = [
            {"account_code": BANK_CODE, "debit": amount, "credit": 0},
            {"account_code": account_code, "debit": 0, "credit": amount},
        ]
    else:
        is_credit = (txn.get("credit") or 0) > 0
        if is_credit:
            lines = [
                {"account_code": BANK_CODE, "debit": amount, "credit": 0},
                {"account_code": account_code, "debit": 0, "credit": amount},
            ]
        else:
            lines = [
                {"account_code": account_code, "debit": amount, "credit": 0},
                {"account_code": BANK_CODE, "debit": 0, "credit": amount},
            ]
    tx_date = txn.get("tx_date") or _today()
    entry = store.create_journal_entry(
        company_id,
        period_id=period_id,
        journal_no=next_journal_no(store, company_id),
        tx_date=tx_date,
        reference=txn.get("reference") or f"ledger-{txn['id'][:8]}",
        description=f"{(txn.get('description') or 'Bank transaction')[:120]}",
        status="posted",
        source_type="bank_statement",
        source_id=txn["id"],
        created_by=user_id,
        lines=lines,
    )
    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="journal.posted",
        entity="journal_entries",
        entity_id=entry["id"],
        new_value={
            "journal_no": entry["journal_no"],
            "tx_date": tx_date,
            "account_code": account_code,
            "amount": amount,
        },
    )
    return entry


def _txn_amount(txn: dict) -> float:
    debit = txn.get("debit") or 0
    credit = txn.get("credit") or 0
    return credit if credit > 0 else debit


def _txn_period(store, company_id: str, txn: dict) -> Optional[str]:
    statement_id = txn.get("statement_id")
    if not statement_id:
        return None
    statement = store.get_company_statement(statement_id, company_id)
    return statement.get("period_id") if statement else None


def _today() -> str:
    return datetime.now(timezone.utc).date().isoformat()
