"""End-to-end API tests using FastAPI TestClient."""

from __future__ import annotations

import pathlib
import tempfile
import time

import pytest

from tests.generators.make_statements import build_statement_pdf


@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _auth_headers(client, email: str = "tester@bsi.local") -> dict:
    r = client.post(
        "/api/auth/register",
        json={"email": email, "password": "correct-horse-battery"},
    )
    if r.status_code == 409:  # already registered in this DB
        r = client.post(
            "/api/auth/login",
            json={"email": email, "password": "correct-horse-battery"},
        )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def auth_headers(client) -> dict:
    return _auth_headers(client, "tester@bsi.local")


@pytest.fixture()
def pdf_path():
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    build_statement_pdf(pdf, bank="Access Bank", n_transactions=15, seed=8)
    return pdf


def test_health(client) -> None:
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_templates(client) -> None:
    r = client.get("/api/templates")
    assert r.status_code == 200
    assert "First Bank" in r.json()["banks"]


def test_upload_requires_pdf(client, auth_headers) -> None:
    r = client.post(
        "/api/process",
        files={"upload": ("notes.txt", b"hello", "text/plain")},
        headers=auth_headers,
    )
    assert r.status_code == 400


def test_process_flow(client, auth_headers, pdf_path) -> None:
    with pdf_path.open("rb") as fh:
        r = client.post(
            "/api/process",
            files={"upload": ("stmt.pdf", fh, "application/pdf")},
            headers=auth_headers,
        )
    assert r.status_code == 200
    job_id = r.json()["job_id"]

    status = None
    for _ in range(100):
        job = client.get(f"/api/jobs/{job_id}", headers=auth_headers).json()
        status = job["status"]
        if status in ("completed", "failed"):
            break
        time.sleep(0.2)
    assert status == "completed"

    result = client.get(f"/api/jobs/{job_id}/result", headers=auth_headers).json()
    assert result["meta"]["bank_name"] == "Access Bank"
    real = [
        t for t in result["transactions"]
        if not t["is_beginning_balance"] and not t["is_ending_balance"]
    ]
    assert len(real) == 15  # 15 generated transactions

    for fmt in ("xlsx", "csv", "json", "pdf"):
        e = client.get(
            f"/api/jobs/{job_id}/export", params={"format": fmt}, headers=auth_headers
        )
        assert e.status_code == 200
        assert len(e.content) > 0


def test_apply_edits_recomputes_result(client, auth_headers, pdf_path) -> None:
    with pdf_path.open("rb") as fh:
        r = client.post(
            "/api/process",
            files={"upload": ("stmt.pdf", fh, "application/pdf")},
            headers=auth_headers,
        )
    job_id = r.json()["job_id"]
    for _ in range(100):
        if client.get(f"/api/jobs/{job_id}", headers=auth_headers).json()["status"] == "completed":
            break
        time.sleep(0.2)

    before = client.get(f"/api/jobs/{job_id}/result", headers=auth_headers).json()
    idx = next(
        i
        for i, t in enumerate(before["transactions"])
        if not t["is_beginning_balance"] and not t["is_ending_balance"] and t["debit"] is not None
    )
    original = before["transactions"][idx]
    fixed_amount = 123_456.00

    r = client.post(
        f"/api/jobs/{job_id}/edits",
        json={
            "edits": [
                {
                    "transaction_index": idx,
                    "fields": {
                        "description": "CORRECTED POS PURCHASE SHOPRITE LAGOS",
                        "debit": fixed_amount,
                    },
                }
            ]
        },
        headers=auth_headers,
    )
    assert r.status_code == 200
    after = r.json()
    edited = after["transactions"][idx]
    assert edited["description"] == "CORRECTED POS PURCHASE SHOPRITE LAGOS"
    assert edited["debit"] == fixed_amount
    assert edited["category"] == "POS"

    before_debits = before["summary"]["total_debits"]
    after_debits = after["summary"]["total_debits"]
    assert abs(after_debits - (before_debits - (original["debit"] or 0.0) + fixed_amount)) < 0.01

    persisted = client.get(f"/api/jobs/{job_id}/result", headers=auth_headers).json()
    assert persisted["transactions"][idx]["debit"] == fixed_amount

    bad = client.post(
        f"/api/jobs/{job_id}/edits", json={"edits": "nope"}, headers=auth_headers
    )
    assert bad.status_code == 400


def test_job_not_found(client, auth_headers) -> None:
    assert client.get("/api/jobs/nope", headers=auth_headers).status_code == 404
    assert client.get("/api/jobs/nope/result", headers=auth_headers).status_code == 404


def test_search_after_process(client, auth_headers, pdf_path) -> None:
    with pdf_path.open("rb") as fh:
        r = client.post(
            "/api/process",
            files={"upload": ("stmt.pdf", fh, "application/pdf")},
            headers=auth_headers,
        )
    job_id = r.json()["job_id"]
    for _ in range(100):
        if client.get(f"/api/jobs/{job_id}", headers=auth_headers).json()["status"] == "completed":
            break
        time.sleep(0.2)

    s = client.get("/api/search", params={"q": "salary"}, headers=auth_headers).json()
    assert s["count"] > 0
    s2 = client.get("/api/search", params={"tx_type": "Credit"}, headers=auth_headers).json()
    assert s2["count"] > 0


def test_endpoints_require_auth(client) -> None:
    assert client.post("/api/process").status_code == 401
    assert client.get("/api/jobs").status_code == 401
    assert client.get("/api/jobs/whatever").status_code == 401
    assert client.get("/api/jobs/whatever/result").status_code == 401
    assert client.get("/api/search").status_code == 401


def test_job_is_isolated_between_users(client, auth_headers, pdf_path) -> None:
    """A user must never see another user's statement."""
    # Free-plan users only get a few statements per month; this test is about
    # isolation, not metering, so give the victim a fresh allowance.
    from app.main import _store

    me = client.get("/api/auth/me", headers=auth_headers).json()
    _store.reset_usage(me["id"])

    with pdf_path.open("rb") as fh:
        r = client.post(
            "/api/process",
            files={"upload": ("stmt.pdf", fh, "application/pdf")},
            headers=auth_headers,
        )
    job_id = r.json()["job_id"]
    for _ in range(100):
        if client.get(f"/api/jobs/{job_id}", headers=auth_headers).json()["status"] == "completed":
            break
        time.sleep(0.2)

    other = _auth_headers(client, "intruder@bsi.local")
    assert client.get(f"/api/jobs/{job_id}", headers=other).status_code == 404
    assert client.get(f"/api/jobs/{job_id}/result", headers=other).status_code == 404
    assert client.get(f"/api/jobs/{job_id}/export", headers=other).status_code == 404
    assert client.delete(f"/api/jobs/{job_id}", headers=other).status_code == 404
    # Intruder's own job list must not include the victim's job.
    ids = {j["job_id"] for j in client.get("/api/jobs", headers=other).json()["jobs"]}
    assert job_id not in ids
