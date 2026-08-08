"""Optional live integration test for the Postgres history store.

Skipped unless TEST_DATABASE_URL is set. Run against a real Postgres (e.g.
Neon free tier) to prove the store round-trips jobs and transactions:

    $env:TEST_DATABASE_URL = "postgresql://..."
    pytest tests/test_pg_store_live.py
"""

from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"),
    reason="TEST_DATABASE_URL not set; requires a live Postgres.",
)


@pytest.fixture()
def store() -> "PostgresStore":
    from app.export.pg_store import PostgresStore

    s = PostgresStore(conninfo=os.environ["TEST_DATABASE_URL"])
    s.delete_job("pg-live-test")
    return s


def test_roundtrip_save_and_get_job(store) -> None:
    store.save_job(
        "pg-live-test",
        "stmt.pdf",
        "completed",
        error=None,
    )
    store.update_status("pg-live-test", "failed", "boom")
    job = store.get_job("pg-live-test")
    assert job is not None
    assert job["status"] == "failed"
    assert job["error"] == "boom"


def test_list_jobs(store) -> None:
    store.save_job("pg-live-test", "stmt.pdf", "queued")
    store.update_status("pg-live-test", "completed")
    rows = store.list_jobs(limit=10)
    ids = {r["id"] for r in rows}
    assert "pg-live-test" in ids
    assert all(r["status"] for r in rows)


def test_search_transactions(store) -> None:
    from datetime import date

    from app.core.models import Transaction

    tx = Transaction(
        tx_date=date(2025, 1, 3),
        value_date=date(2025, 1, 4),
        description="MTN DATA AIRTIME",
        reference="REF123",
        debit=2500.0,
        credit=None,
        balance=4500.0,
        tx_type="Debit",
        category="Telecom",
    )
    store.save_job("pg-live-test", "stmt.pdf", "completed")
    with store._conn() as conn, conn.cursor() as cur:  # noqa: SLF001
        cur.execute(
            "INSERT INTO transactions (job_id, row_index, tx_date, value_date, description, reference,"
            " debit, credit, balance, tx_type, category, page_number, line_number)"
            " VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            ("pg-live-test", 0, "2025-01-03", "2025-01-04", tx.description, tx.reference,
             tx.debit, tx.credit, tx.balance, tx.tx_type, tx.category, 1, 3),
        )

    rows = store.search_transactions(q="AIRTIME", limit=10)
    assert any(r["description"] == "MTN DATA AIRTIME" for r in rows)
    rows = store.search_transactions(from_date="2025-01-01", to_date="2025-01-31", limit=10)
    assert any(r["description"] == "MTN DATA AIRTIME" for r in rows)
    rows = store.search_transactions(min_amount=2000, max_amount=3000, limit=10)
    assert any(r["description"] == "MTN DATA AIRTIME" for r in rows)
    rows = store.search_transactions(balance=4500.0, limit=10)
    assert any(r["description"] == "MTN DATA AIRTIME" for r in rows)
