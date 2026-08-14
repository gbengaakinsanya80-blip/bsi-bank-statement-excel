"""Accounting period lifecycle (PRD sections 37-38).

A period moves forward ``open -> review -> approved -> locked``. Once locked,
no user may modify it without an authorised reopening (which still writes an
audit trail entry with the stated reason).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.accounting import audit

STATUSES = ("open", "review", "approved", "locked")

_TRANSITIONS: dict[str, set[str]] = {
    "open": {"review", "approved", "locked"},
    "review": {"approved", "open", "locked"},
    "approved": {"locked", "review", "open"},
    # Reopening a locked period is allowed but always audited with a reason.
    "locked": {"open", "review"},
}


def valid_transition(current: str, new_status: str) -> bool:
    return new_status in _TRANSITIONS.get(current, set())


def transition_period(
    store,
    *,
    company_id: str,
    user_id: str,
    period_id: str,
    new_status: str,
    reason: Optional[str] = None,
) -> dict:
    period = store.get_period(period_id, company_id)
    if period is None:
        raise KeyError("Accounting period not found.")
    current = period["status"]
    if current == new_status:
        return period
    if not valid_transition(current, new_status):
        raise ValueError(f"Cannot move accounting period from {current!r} to {new_status!r}.")
    if new_status == "locked" and not reason:
        raise ValueError("Locking an accounting period requires a reason.")
    locked_at = _now() if new_status == "locked" else None
    updated = store.update_period(period_id, company_id, status=new_status, locked_at=locked_at)
    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="period.status",
        entity="accounting_periods",
        entity_id=period_id,
        old_value={"status": current},
        new_value={"status": new_status},
        reason=reason,
    )
    return updated


def lock_period(
    store,
    *,
    company_id: str,
    user_id: str,
    period_id: str,
    reason: Optional[str] = None,
) -> dict:
    return transition_period(
        store,
        company_id=company_id,
        user_id=user_id,
        period_id=period_id,
        new_status="locked",
        reason=reason,
    )


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()
