"""Thin Paystack API client + webhook signature verification.

Uses ``httpx`` (already a dependency). All calls are wrapped so a missing or
invalid secret key surfaces as a clear :class:`PaystackError` instead of a raw
HTTP error.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from typing import Any, Optional

import httpx

PAYSTACK_API = "https://api.paystack.co"


class PaystackError(RuntimeError):
    pass


def secret_key() -> str:
    return os.environ.get("PAYSTACK_SECRET_KEY", "").strip()


def webhook_secret() -> str:
    return os.environ.get("PAYSTACK_WEBHOOK_SECRET", "").strip()


def configured() -> bool:
    return bool(secret_key())


def _client() -> httpx.Client:
    if not configured():
        raise PaystackError("PAYSTACK_SECRET_KEY is not configured.")
    return httpx.Client(
        base_url=PAYSTACK_API,
        headers={"Authorization": f"Bearer {secret_key()}", "Content-Type": "application/json"},
        timeout=20.0,
    )


def _request(method: str, path: str, payload: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    with _client() as client:
        resp = client.request(method, path, json=payload)
    body = resp.json() if resp.content else {}
    if resp.status_code >= 400:
        raise PaystackError(f"Paystack {path} failed ({resp.status_code}): {body}")
    if body.get("status") is False:
        raise PaystackError(f"Paystack {path} rejected: {body.get('message')}")
    return body.get("data") or {}


def verify_transaction(reference: str) -> dict[str, Any]:
    """Verify a checkout transaction and return its data dict."""
    return _request("GET", f"/transaction/verify/{reference}")


def get_subscription(subscription_code: str) -> dict[str, Any]:
    return _request("GET", f"/subscription/{subscription_code}")


def disable_subscription(subscription_code: str, token: str) -> dict[str, Any]:
    return _request(
        "POST",
        f"/subscription/{subscription_code}/disable",
        {"code": subscription_code, "token": token},
    )


def get_customer(customer_code: str) -> dict[str, Any]:
    return _request("GET", f"/customer/{customer_code}")


def verify_webhook_signature(payload: bytes, signature: Optional[str]) -> bool:
    secret = webhook_secret()
    if not secret or not signature:
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()
    return hmac.compare_digest(expected, signature)
