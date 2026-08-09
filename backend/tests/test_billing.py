"""Tests for billing plans, quota enforcement and webhooks."""

from __future__ import annotations

import json

import pytest

from app.billing.service import billing_status, quota_exceeded


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _auth_headers(client, email: str = "bill@bsi.local") -> dict:
    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": "correct-horse-battery"},
    )
    if r.status_code == 409:
        r = client.post(
            "/api/auth/login",
            json={"email": email, "password": "correct-horse-battery"},
        )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_plans_public(client) -> None:
    r = client.get("/api/billing/plans")
    assert r.status_code == 200
    body = r.json()
    codes = {p["code"] for p in body["plans"]}
    assert {"free", "pro", "business"} <= codes
    free = next(p for p in body["plans"] if p["code"] == "free")
    assert free["monthly_statements"] == 3


def test_billing_me_defaults_to_free(client) -> None:
    headers = _auth_headers(client, "bill.free@bsi.local")
    r = client.get("/api/billing/me", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["plan"] == "free"
    assert body["monthly_limit"] == 3
    assert body["statements_used"] == 0
    assert body["active"] is True


def test_quota_exceeded_after_limit(client, monkeypatch) -> None:
    from app.main import _store

    headers = _auth_headers(client, "bill.limit@bsi.local")
    r = client.get("/api/auth/me", headers=headers)
    user_id = r.json()["id"]
    _store.reset_usage(user_id)

    assert quota_exceeded(_store, user_id) is False
    for _ in range(3):
        _store.record_usage(user_id)
    assert quota_exceeded(_store, user_id) is True

    # Upload attempt is blocked with 402 while over the free limit.
    upload = client.post(
        "/api/process",
        files={"upload": ("stmt.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers,
    )
    assert upload.status_code == 402

    status = billing_status(_store, user_id)
    assert status["statements_used"] == 3
    assert status["plan"] == "free"


def test_subscribe_requires_paystack(client) -> None:
    headers = _auth_headers(client, "bill.nopay@bsi.local")
    r = client.post(
        "/api/billing/subscribe",
        json={"plan": "pro", "reference": "ref-123"},
        headers=headers,
    )
    assert r.status_code == 503


def test_webhook_requires_signature(client) -> None:
    r = client.post(
        "/api/billing/webhook",
        content=json.dumps({"event": "invoice.paid", "data": {}}),
        headers={"Content-Type": "application/json"},
    )
    assert r.status_code == 400


def test_cancel_requires_auth(client) -> None:
    assert client.post("/api/billing/cancel").status_code == 401
