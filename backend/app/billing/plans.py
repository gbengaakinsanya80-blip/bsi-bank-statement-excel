"""Subscription plan definitions and limits.

Prices are in kobo (NGN) because that is what the Paystack API expects.
A ``monthly_statements`` of ``None`` means unlimited.
"""

from __future__ import annotations

import os
from typing import Any, Optional

FREE_MONTHLY_LIMIT = int(os.environ.get("BSI_FREE_MONTHLY_LIMIT", "3"))

PLANS: dict[str, dict[str, Any]] = {
    "free": {
        "code": "free",
        "name": "Free",
        "price_kobo": 0,
        "monthly_statements": FREE_MONTHLY_LIMIT,
        "interval": "monthly",
        "paystack_plan": "",
    },
    "pro": {
        "code": "pro",
        "name": "Pro",
        "price_kobo": int(os.environ.get("BSI_PRO_PRICE_KOBO", "250000")),
        "monthly_statements": None,
        "interval": "monthly",
        "paystack_plan": os.environ.get("PAYSTACK_PLAN_PRO", ""),
    },
    "business": {
        "code": "business",
        "name": "Business",
        "price_kobo": int(os.environ.get("BSI_BUSINESS_PRICE_KOBO", "500000")),
        "monthly_statements": None,
        "interval": "monthly",
        "paystack_plan": os.environ.get("PAYSTACK_PLAN_BUSINESS", ""),
    },
}


def get_plan(code: Optional[str]) -> Optional[dict[str, Any]]:
    if not code:
        return None
    return PLANS.get(code)


def monthly_limit(code: Optional[str]) -> Optional[int]:
    plan = get_plan(code)
    return plan["monthly_statements"] if plan else 0


def public_plans() -> list[dict[str, Any]]:
    """Plans exposed to the frontend, prices in NGN."""
    out = []
    for plan in PLANS.values():
        out.append(
            {
                "code": plan["code"],
                "name": plan["name"],
                "price_ngn": plan["price_kobo"] // 100,
                "monthly_statements": plan["monthly_statements"],
                "interval": plan["interval"],
                "paystack_plan": plan["paystack_plan"],
            }
        )
    return out
