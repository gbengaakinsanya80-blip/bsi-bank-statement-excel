"""Search service wrapping the SQLite transaction index."""

from __future__ import annotations

from typing import Any, Optional

from app.core.config import SEARCH_LIMIT
from app.export.sqlite_store import Store


def search(
    store: Store,
    *,
    q: str = "",
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    min_amount: Optional[float] = None,
    max_amount: Optional[float] = None,
    balance: Optional[float] = None,
    tx_type: str = "",
    category: str = "",
    job_id: str = "",
    limit: int = SEARCH_LIMIT,
) -> dict[str, Any]:
    rows = store.search_transactions(
        q=q,
        from_date=from_date,
        to_date=to_date,
        min_amount=min_amount,
        max_amount=max_amount,
        balance=balance,
        tx_type=tx_type,
        category=category,
        job_id=job_id,
        limit=limit,
    )
    total_credits = sum(r.get("credit") or 0.0 for r in rows)
    total_debits = sum(r.get("debit") or 0.0 for r in rows)
    return {
        "count": len(rows),
        "total_credits": round(total_credits, 2),
        "total_debits": round(total_debits, 2),
        "filters": {
            "q": q,
            "from_date": from_date,
            "to_date": to_date,
            "min_amount": min_amount,
            "max_amount": max_amount,
            "balance": balance,
            "tx_type": tx_type,
            "category": category,
            "job_id": job_id,
        },
        "rows": rows,
    }
