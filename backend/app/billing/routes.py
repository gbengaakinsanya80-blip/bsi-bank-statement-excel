"""FastAPI routes for billing & subscriptions (Paystack)."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth.deps import get_current_user
from app.billing import paystack
from app.billing.plans import PLANS, public_plans
from app.billing.service import (
    activate_plan,
    billing_status,
    cancel_subscription,
    handle_webhook,
)
from app.export.sqlite_store import Store

logger = logging.getLogger(__name__)


def build_billing_router(store: Store) -> APIRouter:
    router = APIRouter(prefix="/billing", tags=["billing"])

    @router.get("/plans")
    def plans() -> dict:
        return {
            "plans": public_plans(),
            "paystack_public_key": _env("PAYSTACK_PUBLIC_KEY"),
        }

    @router.get("/me")
    def me(user: dict = Depends(get_current_user)) -> dict:
        return billing_status(store, user["id"])

    @router.post("/subscribe")
    def subscribe(payload: dict = ..., user: dict = Depends(get_current_user)) -> dict:
        body = payload or {}
        plan_code = body.get("plan")
        reference = body.get("reference")
        if plan_code not in PLANS or plan_code == "free":
            raise HTTPException(400, "Invalid plan.")
        if not reference:
            raise HTTPException(400, "A Paystack transaction reference is required.")
        if not paystack.configured():
            raise HTTPException(503, "Paystack is not configured on this server.")

        try:
            txn = paystack.verify_transaction(reference)
        except paystack.PaystackError as exc:
            logger.warning("Paystack verification failed for %s: %s", reference, exc)
            raise HTTPException(402, "Payment could not be verified.") from exc

        if txn.get("status") != "success":
            raise HTTPException(402, "Payment was not successful.")

        plan_info = txn.get("plan") or {}
        expected = PLANS[plan_code]["paystack_plan"]
        if expected and plan_info.get("plan_code") != expected:
            raise HTTPException(400, "Transaction does not match the requested plan.")
        if txn.get("amount") != PLANS[plan_code]["price_kobo"]:
            raise HTTPException(400, "Transaction amount does not match the plan price.")

        customer = txn.get("customer") or {}
        customer_email = (customer.get("email") or "").lower()
        if customer_email and customer_email != (user["email"] or "").lower():
            raise HTTPException(400, "Payment email does not match your account.")

        subscription = txn.get("subscription") or {}
        sub_code = subscription.get("subscription_code")
        next_payment = subscription.get("next_payment_date")
        if sub_code and next_payment is None:
            try:
                sub = paystack.get_subscription(sub_code)
                next_payment = (sub.get("subscription") or {}).get("next_payment_date")
            except paystack.PaystackError:
                next_payment = None
        expiry = next_payment or (
            datetime.now(timezone.utc) + timedelta(days=30)
        ).isoformat()

        activate_plan(
            store,
            user["id"],
            plan_code=plan_code,
            customer_code=customer.get("customer_code"),
            subscription_id=sub_code,
            expires_at=expiry,
        )
        return billing_status(store, user["id"])

    @router.post("/cancel")
    def cancel(user: dict = Depends(get_current_user)) -> dict:
        try:
            return cancel_subscription(store, user["id"])
        except paystack.PaystackError as exc:
            logger.warning("Cancel downgrade issue: %s", exc)
            raise HTTPException(502, "Could not contact Paystack.") from exc

    @router.post("/webhook")
    async def webhook(request: Request) -> dict:
        payload = await request.body()
        signature = request.headers.get("x-paystack-signature")
        if not paystack.verify_webhook_signature(payload, signature):
            raise HTTPException(400, "Invalid signature.")
        event = paystack.parse_webhook(payload)
        ack = handle_webhook(store, event)
        logger.info("Paystack webhook handled: %s", ack)
        return {"handled": ack}

    return router


def _env(name: str) -> Optional[str]:
    import os

    return os.environ.get(name) or None
