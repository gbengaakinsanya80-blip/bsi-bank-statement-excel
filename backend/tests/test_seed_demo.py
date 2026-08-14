"""Demo seed data tests: company + COA + period + posted journals in one call.

Covers the "try it" flow used to populate the Ledger and Reports pages with
realistic content immediately, plus the auth-scoped API endpoint.
"""

from __future__ import annotations

import pytest

from app.accounting import posting, seed_demo
from app.export.sqlite_store import Store


@pytest.fixture()
def store() -> Store:
    return Store()


# ---------------------------------------------------------------------- #
# Seed function
# ---------------------------------------------------------------------- #
def test_seed_demo_company(store: Store) -> None:
    result = seed_demo.seed_demo_company(store, user_id="demo-user")
    assert result["created"] is True
    assert result["company"]["name"] == seed_demo.DEMO_NAME
    assert result["company"]["user_id"] == "demo-user"
    assert result["posted"] == 16  # 5 sales + 3 purchases + 8 expenses

    company_id = result["company"]["id"]

    # COA is present and includes the codes we posted against.
    codes = {a["code"] for a in store.list_chart_of_accounts(company_id)}
    assert {"1010", "3010", "4010", "5010", "6020"}.issubset(codes)

    # One open period, one bank account, one linked statement.
    periods = store.list_periods(company_id)
    assert len(periods) == 1 and periods[0]["status"] == "open"
    assert len(store.list_bank_accounts(company_id)) == 1
    assert len(store.list_company_statements(company_id)) == 1

    # 16 statement journals + 1 opening-capital adjustment = 17 posted entries.
    entries = store.list_journal_entries(company_id)
    assert len(entries) == 17
    assert all(e["status"] == "posted" for e in entries)
    assert sum(1 for e in entries if e["source_type"] == "adjustment") == 1

    # Trial balance balances and shows a positive bank balance.
    tb = posting.trial_balance(store, company_id=company_id)
    assert tb["balanced"] is True
    assert tb["total_debit"] == tb["total_credit"]
    bank = next(a for a in tb["accounts"] if a["code"] == "1010")
    assert bank["balance_side"] == "debit"
    assert bank["balance"] > 0


def test_seed_demo_is_idempotent(store: Store) -> None:
    seed_demo.seed_demo_company(store, user_id="demo-user")
    second = seed_demo.seed_demo_company(store, user_id="demo-user")
    assert second["created"] is False
    assert len(store.list_companies("demo-user")) == 1
    # Existing data is untouched by a repeat call.
    assert len(store.list_journal_entries(store.list_companies("demo-user")[0]["id"])) == 17


# ---------------------------------------------------------------------- #
# API layer
# ---------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _auth_headers(client, email: str) -> dict:
    r = client.post("/api/auth/register", json={"email": email, "password": "correct-horse-battery"})
    if r.status_code == 409:
        r = client.post("/api/auth/login", json={"email": email, "password": "correct-horse-battery"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_api_demo_seed_endpoint(client) -> None:
    headers = _auth_headers(client, "demo-api@bsi.local")

    r = client.post("/api/demo/seed", headers=headers)
    assert r.status_code == 200, r.text
    payload = r.json()
    assert payload["created"] is True
    assert payload["posted"] == 16

    company_id = payload["company"]["id"]

    tb = client.get(f"/api/companies/{company_id}/trial-balance", headers=headers).json()
    assert tb["balanced"] is True
    assert tb["total_debit"] > 0

    journals = client.get(f"/api/companies/{company_id}/journals", headers=headers).json()
    assert journals["total"] == 17

    reports = client.get(
        f"/api/companies/{company_id}/reports/income-statement", headers=headers
    )
    assert reports.status_code == 200, reports.text
    assert reports.json()["net_profit"] > 0

    # Re-seeding returns the same company instead of a duplicate.
    again = client.post("/api/demo/seed", headers=headers).json()
    assert again["created"] is False
    assert again["company"]["id"] == company_id


def test_api_demo_seed_requires_auth(client) -> None:
    r = client.post("/api/demo/seed")
    assert r.status_code == 401
