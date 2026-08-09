"""Tests for the auth endpoints (register / login / me / password hashing)."""

from __future__ import annotations

import uuid

import pytest

from tests.test_api import _auth_headers

_SUFFIX = uuid.uuid4().hex[:8]


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _email(name: str) -> str:
    return f"{name}-{_SUFFIX}@bsi.local"


def _register(client, email: str, password: str):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def test_register_and_login(client) -> None:
    email = _email("reg")
    r = _register(client, email, "password123")
    assert r.status_code == 200
    body = r.json()
    assert body["token"]
    assert body["user"]["email"] == email

    login = client.post(
        "/api/auth/login", json={"email": email, "password": "password123"}
    )
    assert login.status_code == 200
    assert login.json()["user"]["email"] == email


def test_register_rejects_duplicate_email(client) -> None:
    email = _email("dup")
    _register(client, email, "password123")
    r = _register(client, email, "password123")
    assert r.status_code == 409


def test_register_validates_email_and_password(client) -> None:
    assert _register(client, "not-an-email", "password123").status_code == 400
    assert _register(client, _email("short"), "short").status_code == 400


def test_login_wrong_password(client) -> None:
    email = _email("wrong")
    _register(client, email, "password123")
    r = client.post(
        "/api/auth/login", json={"email": email, "password": "nope"}
    )
    assert r.status_code == 401


def test_login_unknown_email(client) -> None:
    r = client.post("/api/auth/login", json={"email": _email("ghost"), "password": "whatever"})
    assert r.status_code == 401


def test_email_is_case_insensitive(client) -> None:
    email = _email("case")
    _register(client, email, "password123")
    login = client.post(
        "/api/auth/login", json={"email": email.upper(), "password": "password123"}
    )
    assert login.status_code == 200


def test_me_requires_valid_token(client) -> None:
    assert client.get("/api/auth/me").status_code == 401
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": "Bearer garbage.token.here"}
        ).status_code
        == 401
    )


def test_password_hashes_are_not_plaintext(client) -> None:
    from app.export.store import get_store

    store = get_store()
    email = _email("hashcheck")
    _register(client, email, "password123")
    user = store.get_user_by_email(email)
    assert user is not None
    assert user["password_hash"] != "password123"
    assert "password123" not in user["password_hash"]


def test_auth_headers_helper_roundtrip(client) -> None:
    email = _email("helper")
    h = _auth_headers(client, email)
    me = client.get("/api/auth/me", headers=h)
    assert me.status_code == 200
    assert me.json()["email"] == email
