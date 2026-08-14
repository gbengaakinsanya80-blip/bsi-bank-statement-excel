"""Accounting foundation tests: COA, companies, periods, bank accounts, linking.

Covers Phase 1 of the FinancePilot AI build: the deterministic accounting
foundations (schema + companies + chart of accounts + accounting periods +
bank accounts + statement linking + audit trail).
"""

from __future__ import annotations

import time

import pytest

from app.accounting import linking, periods
from app.accounting.coa import DEFAULT_COA, generate_default_coa
from app.export.sqlite_store import Store


@pytest.fixture()
def store() -> Store:
    """A fresh SQLite store inside the session-scoped temp data dir."""
    return Store()


# ---------------------------------------------------------------------- #
# Chart of accounts generation
# ---------------------------------------------------------------------- #
def test_generate_default_coa() -> None:
    accounts = generate_default_coa()
    assert len(accounts) == len(DEFAULT_COA)
    codes = [a["code"] for a in accounts]
    assert len(codes) == len(set(codes)), "COA codes must be unique"
    assert {a["account_type"] for a in accounts} == {"asset", "liability", "equity", "income", "expense"}
    bank = next(a for a in accounts if a["code"] == "1010")
    assert bank["name"] == "Bank" and bank["normal_balance"] == "debit"
    revenue = next(a for a in accounts if a["code"] == "4010")
    assert revenue["normal_balance"] == "credit"


def test_generate_industry_coa() -> None:
    construction = generate_default_coa("construction")
    codes = [a["code"] for a in construction]
    assert "5050" in codes  # Direct Construction Costs
    assert len(codes) == len(set(codes))
    assert len(construction) > len(DEFAULT_COA)


# ---------------------------------------------------------------------- #
# Companies
# ---------------------------------------------------------------------- #
def test_company_crud_and_isolation(store: Store) -> None:
    company = store.create_company(
        user_id="u1", name="ABC Trading Ltd", industry="retail", reg_number="RC-1234"
    )
    assert company["id"]
    assert company["user_id"] == "u1"
    assert company["industry"] == "retail"
    assert company["currency"] == "NGN"

    got = store.get_company(company["id"], "u1")
    assert got["name"] == "ABC Trading Ltd"

    # Other users cannot see or touch the company.
    assert store.get_company(company["id"], "u2") is None
    assert store.list_companies("u2") == []

    updated = store.update_company(company["id"], "u1", industry="construction", reg_number="RC-9999")
    assert updated["industry"] == "construction"
    assert updated["reg_number"] == "RC-9999"

    assert len(store.list_companies("u1")) == 1
    assert store.delete_company(company["id"], "u1") is True
    assert store.get_company(company["id"], "u1") is None


def test_company_defaults(store: Store) -> None:
    company = store.create_company(user_id="u1", name="Solo")
    assert company["country"] == "Nigeria"
    assert company["accounting_basis"] == "cash"
    assert company["industry"] == "general"


# ---------------------------------------------------------------------- #
# Chart of accounts store
# ---------------------------------------------------------------------- #
def test_coa_replace_and_crud(store: Store) -> None:
    company = store.create_company(user_id="u1", name="X")
    store.replace_chart_of_accounts(company["id"], generate_default_coa())
    assert len(store.list_chart_of_accounts(company["id"])) == len(DEFAULT_COA)

    account = store.add_chart_account(
        company["id"], code="7000", name="Custom Expense", account_type="expense", normal_balance="debit"
    )
    assert store.get_chart_account(account["id"], company["id"])["code"] == "7000"
    assert store.get_chart_account(account["id"], "wrong-company") is None

    renamed = store.update_chart_account(account["id"], company["id"], name="Renamed Expense")
    assert renamed["name"] == "Renamed Expense"

    assert store.delete_chart_account(account["id"], company["id"]) is True
    assert store.get_chart_account(account["id"], company["id"]) is None


# ---------------------------------------------------------------------- #
# Accounting periods
# ---------------------------------------------------------------------- #
def test_period_lifecycle_and_audit(store: Store) -> None:
    company = store.create_company(user_id="u1", name="X")
    period = store.create_period(
        company["id"], name="Jan 2026", start_date="2026-01-01", end_date="2026-01-31"
    )
    assert period["status"] == "open"

    assert periods.valid_transition("open", "review") is True
    assert periods.valid_transition("open", "locked") is True
    assert periods.valid_transition("locked", "approved") is False

    locked = periods.lock_period(
        store, company_id=company["id"], user_id="u1", period_id=period["id"], reason="Closing January"
    )
    assert locked["status"] == "locked"
    assert locked["locked_at"] is not None

    # A locked period cannot jump to approved.
    with pytest.raises(ValueError):
        periods.transition_period(
            store, company_id=company["id"], user_id="u1", period_id=period["id"], new_status="approved"
        )

    # Locking without a reason is refused.
    fresh = store.create_period(company["id"], name="Feb", start_date="2026-02-01", end_date="2026-02-28")
    with pytest.raises(ValueError):
        periods.lock_period(
            store, company_id=company["id"], user_id="u1", period_id=fresh["id"], reason=None
        )

    # Every transition writes an audit entry.
    logs = store.list_audit_logs(company["id"])
    assert any(e["action"] == "period.status" for e in logs)


def test_period_transition_requires_company(store: Store) -> None:
    with pytest.raises(KeyError):
        periods.transition_period(
            store, company_id="nope", user_id="u1", period_id="nope", new_status="locked"
        )


# ---------------------------------------------------------------------- #
# Bank accounts
# ---------------------------------------------------------------------- #
def test_bank_account_crud(store: Store) -> None:
    company = store.create_company(user_id="u1", name="X")
    account = store.create_bank_account(
        company["id"], name="Main Account", bank_name="Zenith", account_number="2212345678"
    )
    assert store.get_bank_account(account["id"], company["id"])["account_number"] == "2212345678"
    assert store.get_bank_account(account["id"], "other-company") is None
    assert len(store.list_bank_accounts(company["id"])) == 1
    assert store.delete_bank_account(account["id"], company["id"]) is True


# ---------------------------------------------------------------------- #
# Statement linking
# ---------------------------------------------------------------------- #
class _FakeJobs:
    def __init__(self, job: dict | None) -> None:
        self._job = job

    def get(self, job_id: str, user_id: str | None = None) -> dict | None:
        if self._job and self._job["id"] == job_id:
            return self._job
        return None


def test_link_statement_rejects_incomplete_job(store: Store) -> None:
    company = store.create_company(user_id="u1", name="X")
    fake = _FakeJobs({"id": "j1", "status": "running"})
    with pytest.raises(ValueError):
        linking.link_statement(store, fake, company_id=company["id"], user_id="u1", job_id="j1")


def test_link_statement_rejects_foreign_job(store: Store) -> None:
    company = store.create_company(user_id="u1", name="X")
    fake = _FakeJobs({"id": "j1", "status": "completed"})
    with pytest.raises(KeyError):
        linking.link_statement(store, fake, company_id=company["id"], user_id="u1", job_id="other")


def test_link_and_unlink_statement(store: Store) -> None:
    company = store.create_company(user_id="u1", name="X")
    period = store.create_period(
        company["id"], name="Jan 2026", start_date="2026-01-01", end_date="2026-01-31"
    )
    bank = store.create_bank_account(company["id"], name="Main")
    store.save_job("j1", "stmt.pdf", "completed", user_id="u1")

    linked = linking.link_statement(
        store,
        _FakeJobs({"id": "j1", "status": "completed"}),
        company_id=company["id"],
        user_id="u1",
        job_id="j1",
        bank_account_id=bank["id"],
        period_id=period["id"],
    )
    assert linked["job_id"] == "j1"

    rows = linking.enrich_statements(store, store.list_company_statements(company["id"]))
    assert rows[0]["job_meta"]["filename"] == "stmt.pdf"
    assert rows[0]["period"]["name"] == "Jan 2026"
    assert rows[0]["bank_account"]["name"] == "Main"

    assert linking.unlink_statement(
        store, company_id=company["id"], user_id="u1", statement_id=linked["id"]
    ) is True
    assert store.list_company_statements(company["id"]) == []


# ---------------------------------------------------------------------- #
# API layer
# ---------------------------------------------------------------------- #
@pytest.fixture(scope="module")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


def _auth_headers(client, email: str) -> dict:
    r = client.post(
        "/api/auth/register", json={"email": email, "password": "correct-horse-battery"}
    )
    if r.status_code == 409:
        r = client.post(
            "/api/auth/login", json={"email": email, "password": "correct-horse-battery"}
        )
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['token']}"}


@pytest.fixture(scope="module")
def acct_headers(client) -> dict:
    return _auth_headers(client, "accounting@bsi.local")


def test_api_company_flow(client, acct_headers, pdf_path) -> None:
    # Create company with auto-COA.
    r = client.post(
        "/api/companies",
        json={"name": "ABC Trading", "trading_name": "ABC", "industry": "construction"},
        headers=acct_headers,
    )
    assert r.status_code == 200, r.text
    company = r.json()
    company_id = company["id"]
    assert company["industry"] == "construction"

    accounts = client.get(
        f"/api/companies/{company_id}/chart-of-accounts", headers=acct_headers
    ).json()["accounts"]
    assert len(accounts) == len(generate_default_coa("construction"))

    # Invalid industry is rejected.
    bad = client.post(
        "/api/companies", json={"name": "Bad", "industry": "nope"}, headers=acct_headers
    )
    assert bad.status_code == 422

    # User isolation: another user cannot read it.
    other = _auth_headers(client, "accounting-other@bsi.local")
    assert client.get(f"/api/companies/{company_id}", headers=other).status_code == 404

    # Update company.
    up = client.put(f"/api/companies/{company_id}", json={"industry": "retail"}, headers=acct_headers)
    assert up.status_code == 200
    assert up.json()["industry"] == "retail"

    # Add + delete a COA account.
    added = client.post(
        f"/api/companies/{company_id}/chart-of-accounts",
        json={"code": "7000", "name": "Test", "account_type": "expense", "normal_balance": "debit"},
        headers=acct_headers,
    )
    assert added.status_code == 200
    assert client.delete(
        f"/api/companies/{company_id}/chart-of-accounts/{added.json()['id']}", headers=acct_headers
    ).status_code == 200

    # Regenerating requires confirmation.
    assert client.post(
        f"/api/companies/{company_id}/coa/generate", json={}, headers=acct_headers
    ).status_code == 422
    gen = client.post(
        f"/api/companies/{company_id}/coa/generate", json={"confirm": True}, headers=acct_headers
    )
    assert gen.status_code == 200
    assert len(gen.json()["accounts"]) == len(generate_default_coa("retail"))

    # Periods: create, lock, reject invalid transition.
    per = client.post(
        f"/api/companies/{company_id}/periods",
        json={"name": "Jan 2026", "start_date": "2026-01-01", "end_date": "2026-01-31"},
        headers=acct_headers,
    )
    assert per.status_code == 200
    period_id = per.json()["id"]

    lock = client.post(
        f"/api/companies/{company_id}/periods/{period_id}/lock",
        json={"reason": "Closing January"},
        headers=acct_headers,
    )
    assert lock.status_code == 200
    assert lock.json()["status"] == "locked"

    bad_transition = client.put(
        f"/api/companies/{company_id}/periods/{period_id}",
        json={"status": "approved"},
        headers=acct_headers,
    )
    assert bad_transition.status_code == 400

    # Bank accounts.
    bank = client.post(
        f"/api/companies/{company_id}/bank-accounts",
        json={"name": "Main", "bank_name": "Zenith", "account_number": "1002"},
        headers=acct_headers,
    )
    assert bank.status_code == 200
    bank_id = bank.json()["id"]

    # Link a real processed statement.
    with pdf_path.open("rb") as fh:
        r = client.post(
            "/api/process",
            files={"upload": ("stmt.pdf", fh, "application/pdf")},
            headers=acct_headers,
        )
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    status = None
    for _ in range(100):
        status = client.get(f"/api/jobs/{job_id}", headers=acct_headers).json()["status"]
        if status in ("completed", "failed"):
            break
        time.sleep(0.2)
    assert status == "completed"

    link = client.post(
        f"/api/companies/{company_id}/statements",
        json={"job_id": job_id, "bank_account_id": bank_id, "period_id": period_id},
        headers=acct_headers,
    )
    assert link.status_code == 200, link.text
    statements = client.get(
        f"/api/companies/{company_id}/statements", headers=acct_headers
    ).json()["statements"]
    assert len(statements) == 1
    assert statements[0]["job_meta"]["filename"] == "stmt.pdf"

    # Linking a running/foreign job fails cleanly.
    not_done = client.post(
        f"/api/companies/{company_id}/statements",
        json={"job_id": "missing-job"},
        headers=acct_headers,
    )
    assert not_done.status_code == 404

    # Audit trail is populated.
    logs = client.get(f"/api/companies/{company_id}/audit-log", headers=acct_headers).json()["entries"]
    assert logs
    assert any(e["action"] == "period.status" for e in logs)

    # Tear down: delete company (cascades children).
    assert client.delete(f"/api/companies/{company_id}", headers=acct_headers).status_code == 200
    assert client.get(f"/api/companies/{company_id}", headers=acct_headers).status_code == 404


def test_api_companies_require_auth(client) -> None:
    assert client.get("/api/companies").status_code == 401
    assert client.post("/api/companies", json={"name": "X"}).status_code == 401


# pdf_path helper mirrors test_api so the link test can use a real job.
@pytest.fixture(scope="module")
def pdf_path():
    import pathlib
    import tempfile

    from tests.generators.make_statements import build_statement_pdf

    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    build_statement_pdf(pdf, bank="Access Bank", n_transactions=6, seed=3)
    return pdf
