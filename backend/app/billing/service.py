"""Billing service: plan status, quota checks, subscription lifecycle."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from app.billing import paystack
from app.billing.plans import get_plan, monthly_limit, public_plans
from app.export.sqlite_store import Store

logger = logging.getLogger(__name__)


def _parse_utc(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _is_expired(expires_at: Optional[str]) -> bool:
    dt = _parse_utc(expires_at)
    if dt is None:
        return False
    return dt < datetime.now(timezone.utc)


def effective_plan(user: Optional[dict[str, Any]]) -> str:
    """Return the plan that currently applies (paid plans lapse on expiry)."""
    code = (user or {}).get("plan") or "free"
    if code == "free":
        return "free"
    if _is_expired((user or {}).get("plan_expires_at")):
        return "free"
    return code


def billing_status(store: Store, user_id: str) -> dict[str, Any]:
    user = store.get_user_by_id(user_id)
    if user is None:
        raise ValueError("User not found")
    plan_code = effective_plan(user)
    plan = get_plan(plan_code) or get_plan("free")
    month, used = store.get_usage(user_id)
    limit = plan["monthly_statements"]
    return {
        "plan": plan["code"],
        "plan_name": plan["name"],
        "price_ngn": plan["price_kobo"] // 100,
        "monthly_limit": limit,
        "unlimited": limit is None,
        "statements_used": used,
        "usage_month": month,
        "expires_at": user.get("plan_expires_at"),
        "active": plan_code == "free" or not _is_expired(user.get("plan_expires_at")),
        "customer_code": user.get("paystack_customer_code"),
    }


def quota_exceeded(store: Store, user_id: str) -> bool:
    user = store.get_user_by_id(user_id)
    code = effective_plan(user)
    limit = monthly_limit(code)
    if limit is None:
        return False
    _, used = store.get_usage(user_id)
    return used >= limit


def record_statement(store: Store, user_id: Optional[str]) -> None:
    if user_id:
        store.record_usage(user_id)


def activate_plan(
    store: Store,
    user_id: str,
    *,
    plan_code: str,
    customer_code: Optional[str] = None,
    subscription_id: Optional[str] = None,
    expires_at: Optional[str] = None,
) -> None:
    if get_plan(plan_code) is None:
        raise ValueError(f"Unknown plan: {plan_code}")
    store.update_user_plan(
        user_id,
        plan=plan_code,
        paystack_customer_code=customer_code,
        subscription_id=subscription_id,
        plan_expires_at=expires_at,
    )
    store.reset_usage(user_id)


def cancel_subscription(store: Store, user_id: str) -> dict[str, Any]:
    user = store.get_user_by_id(user_id)
    if user is None:
        raise ValueError("User not found")
    sub_id = user.get("subscription_id")
    customer_code = user.get("paystack_customer_code")
    if sub_id and customer_code:
        try:
            customer = paystack.get_customer(customer_code)
            auth = (customer.get("authorizations") or [{}])[0]
            token = auth.get("authorization_code")
            if token:
                paystack.disable_subscription(sub_id, token)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Could not disable Paystack subscription %s: %s", sub_id, exc)
    store.update_user_plan(user_id, plan="free", clear_subscription=True)
    return billing_status(store, user_id)


def _plan_from_code(plan_code: Optional[str]) -> Optional[str]:
    if not plan_code:
        return None
    for plan in public_plans():
        if plan["paystack_plan"] == plan_code:
            return plan["code"]
    return None


def _next_payment(data: dict[str, Any]) -> Optional[str]:
    sub = data.get("subscription") or {}
    return sub.get("next_payment_date") or data.get("next_payment_date")


def _subscription_code(data: dict[str, Any]) -> Optional[str]:
    sub = data.get("subscription") or {}
    return sub.get("subscription_code") or data.get("subscription_code") or data.get("id")


def handle_webhook(store: Store, event: dict[str, Any]) -> str:
    """Apply a Paystack webhook event. Returns a short log/ack string."""
    name = event.get("event") or ""
    data = event.get("data") or {}
    sub_code = _subscription_code(data)

    if sub_code:
        user = store.get_user_by_subscription(sub_code)
    else:
        user = None
    if user is None:
        return f"no-match:{name}"

    user_id = user["id"]
    if name in ("invoice.paid", "subscription.create", "charge.success"):
        plan_code = _plan_from_code((data.get("plan") or {}).get("plan_code")) or user.get("plan")
        expiry = _next_payment(data)
        if not expiry:
            expiry = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        activate_plan(
            store,
            user_id,
            plan_code=plan_code or "free",
            customer_code=user.get("paystack_customer_code"),
            subscription_id=sub_code,
            expires_at=expiry,
        )
        return f"activated:{name}"
    if name in (
        "subscription.disable",
        "subscription.expire",
        "subscription.not_renew",
        "charge.failed",
        "subscription.deactivated",
    ):
        store.update_user_plan(user_id, plan="free", clear_subscription=True)
        return f"downgraded:{name}"
    return f"ignored:{name}"
