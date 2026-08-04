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


def test_upload_requires_pdf(client) -> None:
    r = client.post("/api/process", files={"upload": ("notes.txt", b"hello", "text/plain")})
    assert r.status_code == 400


def test_process_flow(client, pdf_path) -> None:
    with pdf_path.open("rb") as fh:
        r = client.post("/api/process", files={"upload": ("stmt.pdf", fh, "application/pdf")})
    assert r.status_code == 200
    job_id = r.json()["job_id"]

    status = None
    for _ in range(100):
        job = client.get(f"/api/jobs/{job_id}").json()
        status = job["status"]
        if status in ("completed", "failed"):
            break
        time.sleep(0.2)
    assert status == "completed"

    result = client.get(f"/api/jobs/{job_id}/result").json()
    assert result["meta"]["bank_name"] == "Access Bank"
    real = [
        t for t in result["transactions"]
        if not t["is_beginning_balance"] and not t["is_ending_balance"]
    ]
    assert len(real) == 15  # 15 generated transactions

    for fmt in ("xlsx", "csv", "json", "pdf"):
        e = client.get(f"/api/jobs/{job_id}/export", params={"format": fmt})
        assert e.status_code == 200
        assert len(e.content) > 0


def test_apply_edits_recomputes_result(client, pdf_path) -> None:
    with pdf_path.open("rb") as fh:
        r = client.post("/api/process", files={"upload": ("stmt.pdf", fh, "application/pdf")})
    job_id = r.json()["job_id"]
    for _ in range(100):
        if client.get(f"/api/jobs/{job_id}").json()["status"] == "completed":
            break
        time.sleep(0.2)

    before = client.get(f"/api/jobs/{job_id}/result").json()
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

    persisted = client.get(f"/api/jobs/{job_id}/result").json()
    assert persisted["transactions"][idx]["debit"] == fixed_amount

    bad = client.post(f"/api/jobs/{job_id}/edits", json={"edits": "nope"})
    assert bad.status_code == 400


def test_job_not_found(client) -> None:
    assert client.get("/api/jobs/nope").status_code == 404
    assert client.get("/api/jobs/nope/result").status_code == 404


def test_search_after_process(client, pdf_path) -> None:
    with pdf_path.open("rb") as fh:
        r = client.post("/api/process", files={"upload": ("stmt.pdf", fh, "application/pdf")})
    job_id = r.json()["job_id"]
    for _ in range(100):
        if client.get(f"/api/jobs/{job_id}").json()["status"] == "completed":
            break
        time.sleep(0.2)

    s = client.get("/api/search", params={"q": "salary"}).json()
    assert s["count"] > 0
    s2 = client.get("/api/search", params={"tx_type": "Credit"}).json()
    assert s2["count"] > 0
