"""Posting engine tests: journals, trial balance, adjustments and reversal.

Covers Phase 3 of the FinancePilot AI build: turning approved classifications
into balanced double-entry journals, the trial balance, manual adjusting
entries with an approval step, and reversing posted journals.
"""

from __future__ import annotations

import time

import pytest

from app.accounting import posting
from app.accounting.coa import generate_default_coa
from app.export.sqlite_store import Store


@pytest.fixture()
def store() -> Store:
    return Store()


@pytest.fixture()
def company(store: Store) -> dict:
    company = store.create_company(user_id="u1", name="Kaltua Foods", industry="retail")
    store.replace_chart_of_accounts(company["id"], generate_default_coa("retail"))
    return company


def _apply_txn(store: Store, company_id: str, statement_id: str = "s1", **fields) -> dict:
    row = {
        "row_index": 0,
        "tx_date": "2026-01-05",
        "description": "TEST TXN",
        "reference": "R1",
        "debit": None,
        "credit": None,
        "balance": 0,
        "category": "Other",
        "account_code": "1200",
        "transaction_type": "Debit",
        "confidence": 0.95,
        "rationale": "test",
        "status": "applied",
        "source": "categorizer",
    }
    row.update(fields)
    store.import_ledger_transactions(
        company_id=company_id, statement_id=statement_id, job_id="j1", rows=[row]
    )
    return store.list_ledger_transactions(company_id, status="applied")[-1]


# ---------------------------------------------------------------------- #
# Journal posting
# ---------------------------------------------------------------------- #
def test_post_credit_transaction(store: Store, company: dict) -> None:
    _apply_txn(
        store, company["id"], description="CUSTOMER PAYMENT",
        reference="R1", credit=250000, account_code="4010", transaction_type="Credit",
    )
    summary = posting.post_applied_transactions(
        store, company_id=company["id"], user_id="u1"
    )
    assert summary["posted"] == 1
    assert summary["skipped"] == 0

    entries = store.list_journal_entries(company["id"])
    assert len(entries) == 1
    entry = store.get_journal_entry(entries[0]["id"], company["id"])
    assert entry["journal_no"].startswith("JRNL-")
    assert entry["source_type"] == "bank_statement"
    assert entry["status"] == "posted"
    lines = {(l["account_code"], l["debit"], l["credit"]) for l in entry["lines"]}
    assert lines == {("1010", 250000.0, 0.0), ("4010", 0.0, 250000.0)}

    # The source row flipped to posted, so re-running posts nothing new.
    summary2 = posting.post_applied_transactions(
        store, company_id=company["id"], user_id="u1"
    )
    assert summary2["posted"] == 0
    assert store.get_ledger_transaction(
        store.list_ledger_transactions(company["id"])[0]["id"], company["id"]
    )["status"] == "posted"


def test_post_debit_transaction(store: Store, company: dict) -> None:
    _apply_txn(
        store, company["id"], description="SALARY PAYMENT",
        debit=500000, account_code="6010", transaction_type="Debit",
    )
    posting.post_applied_transactions(store, company_id=company["id"], user_id="u1")
    entry = store.get_journal_entry(
        store.list_journal_entries(company["id"])[0]["id"], company["id"]
    )
    lines = {(l["account_code"], l["debit"], l["credit"]) for l in entry["lines"]}
    assert lines == {("6010", 500000.0, 0.0), ("1010", 0.0, 500000.0)}


def test_post_skips_review_rows_and_bank_code(store: Store, company: dict) -> None:
    _apply_txn(store, company["id"], description="APPLIED ROW", debit=100, account_code="6140")
    _apply_txn(
        store, company["id"], description="REVIEW ROW", debit=200, account_code="1200",
        status="review",
    )
    # A classified-bank code is redirected to Suspense to keep the entry valid.
    _apply_txn(store, company["id"], description="BANK CODE", debit=300, account_code="1010")

    summary = posting.post_applied_transactions(
        store, company_id=company["id"], user_id="u1"
    )
    assert summary["posted"] == 2

    entries = store.list_journal_entries(company["id"])
    assert len(entries) == 2
    bank_row = next(
        store.get_journal_entry(e["id"], company["id"]) for e in entries
        if "1200" in {l["account_code"] for l in store.get_journal_entry(e["id"], company["id"])["lines"]}
    )
    codes = {l["account_code"] for l in bank_row["lines"]}
    assert codes == {"1010", "1200"}


def test_post_respects_period_and_locked_period(store: Store, company: dict) -> None:
    period = store.create_period(
        company["id"], name="Jan 2026", start_date="2026-01-01", end_date="2026-01-31"
    )
    linked = store.link_statement(
        company_id=company["id"], user_id="u1", job_id="j1", period_id=period["id"]
    )
    _apply_txn(
        store, company["id"], statement_id=linked["id"],
        description="JAN TXN", debit=100, account_code="6140",
    )

    # Explicit period scope posts it.
    summary = posting.post_applied_transactions(
        store, company_id=company["id"], user_id="u1", period_id=period["id"]
    )
    assert summary["posted"] == 1

    # A locked period refuses new postings up front.
    store.update_period(period["id"], company["id"], status="locked")
    _apply_txn(
        store, company["id"], statement_id=linked["id"],
        description="TOO LATE", debit=50, account_code="6140",
    )
    with pytest.raises(ValueError):
        posting.post_applied_transactions(
            store, company_id=company["id"], user_id="u1", period_id=period["id"]
        )

    # Unscoped run silently skips rows in locked periods.
    summary2 = posting.post_applied_transactions(
        store, company_id=company["id"], user_id="u1"
    )
    assert summary2["posted"] == 0


def test_journal_number_sequence(store: Store, company: dict) -> None:
    from datetime import datetime, timezone

    ym = datetime.now(timezone.utc).strftime("%Y%m")
    assert posting.next_journal_no(store, company["id"]) == f"JRNL-{ym}-0001"
    store.create_journal_entry(
        company["id"], journal_no=f"JRNL-{ym}-0001", tx_date="2026-01-01",
        reference="R", description="D", lines=[{"account_code": "1010", "debit": 1, "credit": 0}],
    )
    assert posting.next_journal_no(store, company["id"]) == f"JRNL-{ym}-0002"


def test_journal_entry_store_crud(store: Store, company: dict) -> None:
    entry = store.create_journal_entry(
        company["id"],
        period_id=None,
        journal_no="JRNL-202601-0001",
        tx_date="2026-01-01",
        reference="R1",
        description="Test entry",
        status="posted",
        source_type="bank_statement",
        source_id="txn-1",
        created_by="u1",
        lines=[
            {"account_code": "1010", "debit": 100.0, "credit": 0.0},
            {"account_code": "4010", "debit": 0.0, "credit": 100.0},
        ],
    )
    assert len(entry["lines"]) == 2
    assert store.get_journal_entry(entry["id"], "other-company") is None

    listed = store.list_journal_entries(company["id"])
    assert listed[0]["line_count"] == 2
    assert listed[0]["total_debit"] == 100.0
    assert listed[0]["total_credit"] == 100.0

    assert store.delete_journal(entry["id"], company["id"]) is True
    assert store.list_journal_entries(company["id"]) == []


# ---------------------------------------------------------------------- #
# Trial balance
# ---------------------------------------------------------------------- #
def test_trial_balance_is_balanced(store: Store, company: dict) -> None:
    _apply_txn(store, company["id"], description="SALES", credit=250000, account_code="4010")
    _apply_txn(store, company["id"], description="RENT", debit=150000, account_code="6020")
    _apply_txn(store, company["id"], description="SALARY", debit=50000, account_code="6010")

    posting.post_applied_transactions(store, company_id=company["id"], user_id="u1")
    tb = posting.trial_balance(store, company_id=company["id"])
    assert tb["balanced"] is True
    assert tb["total_debit"] == 450000.0
    assert tb["total_credit"] == 450000.0

    by_code = {a["code"]: a for a in tb["accounts"]}
    assert by_code["1010"]["balance"] == 50000.0  # 250k in - 200k out
    assert by_code["1010"]["balance_side"] == "debit"
    assert by_code["4010"]["balance"] == 250000.0
    assert by_code["4010"]["balance_side"] == "credit"


def test_trial_balance_filters_by_period(store: Store, company: dict) -> None:
    period = store.create_period(
        company["id"], name="Jan", start_date="2026-01-01", end_date="2026-01-31"
    )
    linked = store.link_statement(
        company_id=company["id"], user_id="u1", job_id="j1", period_id=period["id"]
    )
    _apply_txn(
        store, company["id"], statement_id=linked["id"],
        description="JAN", credit=100, account_code="4010",
    )
    posting.post_applied_transactions(store, company_id=company["id"], user_id="u1")

    _apply_txn(store, company["id"], description="NO PERIOD", debit=50, account_code="6140")
    posting.post_applied_transactions(store, company_id=company["id"], user_id="u1")

    all_tb = posting.trial_balance(store, company_id=company["id"])
    jan_tb = posting.trial_balance(store, company_id=company["id"], period_id=period["id"])
    assert all_tb["balanced"] is True
    assert all_tb["total_debit"] == 150.0
    assert jan_tb["total_debit"] == 100.0


# ---------------------------------------------------------------------- #
# Adjustments
# ---------------------------------------------------------------------- #
def test_adjustment_create_approve_and_post(store: Store, company: dict) -> None:
    adj = posting.create_adjustment(
        store, company_id=company["id"], user_id="u1",
        description="Accrue December rent", adj_type="accrual", amount=200000,
    )
    assert adj["approved_by"] is None
    assert adj["journal_id"] is None

    entry = posting.approve_adjustment(
        store, company_id=company["id"], user_id="u1", adj_id=adj["id"],
        debit_code="6020", credit_code="2020",
    )
    assert entry["journal_no"].startswith("JRNL-")
    lines = {(l["account_code"], l["debit"], l["credit"]) for l in entry["lines"]}
    assert lines == {("6020", 200000.0, 0.0), ("2020", 0.0, 200000.0)}

    updated = store.get_adjustment(adj["id"], company["id"])
    assert updated["approved_by"] == "u1"
    assert updated["journal_id"] == entry["id"]

    # Double approval is refused.
    with pytest.raises(ValueError):
        posting.approve_adjustment(
            store, company_id=company["id"], user_id="u1", adj_id=adj["id"],
            debit_code="6020", credit_code="2020",
        )

    tb = posting.trial_balance(store, company_id=company["id"])
    assert tb["balanced"] is True
    assert tb["total_debit"] == 200000.0


def test_adjustment_validation(store: Store, company: dict) -> None:
    with pytest.raises(ValueError):
        posting.create_adjustment(
            store, company_id=company["id"], user_id="u1",
            description="Zero", amount=0,
        )
    with pytest.raises(ValueError):
        posting.create_adjustment(
            store, company_id=company["id"], user_id="u1",
            description="Bad type", adj_type="nope", amount=100,
        )

    adj = posting.create_adjustment(
        store, company_id=company["id"], user_id="u1", description="Bad codes", amount=100
    )
    with pytest.raises(ValueError):
        posting.approve_adjustment(
            store, company_id=company["id"], user_id="u1", adj_id=adj["id"],
            debit_code="9999", credit_code="2020",
        )
    with pytest.raises(ValueError):
        posting.approve_adjustment(
            store, company_id=company["id"], user_id="u1", adj_id=adj["id"],
            debit_code="1010", credit_code="1010",
        )

    # An approved adjustment cannot be deleted via the store guard in routes,
    # but the store-level delete only removes unposted drafts.
    assert store.delete_adjustment(adj["id"], company["id"]) is True
    assert store.get_adjustment(adj["id"], company["id"]) is None


def test_adjustment_store_crud(store: Store, company: dict) -> None:
    adj = store.create_adjustment(
        company["id"], adj_type="manual", description="Fix", amount=5000
    )
    assert len(store.list_adjustments(company["id"])) == 1
    updated = store.update_adjustment(adj["id"], company["id"], amount=6000)
    assert updated["amount"] == 6000
    assert store.get_adjustment(adj["id"], "other-company") is None
    assert store.delete_adjustment(adj["id"], company["id"]) is True
    assert store.list_adjustments(company["id"]) == []


# ---------------------------------------------------------------------- #
# Reversal (unposting)
# ---------------------------------------------------------------------- #
def test_unpost_returns_transaction_to_applied(store: Store, company: dict) -> None:
    txn = _apply_txn(store, company["id"], description="SALES", credit=100, account_code="4010")
    posting.post_applied_transactions(store, company_id=company["id"], user_id="u1")
    entry = store.list_journal_entries(company["id"])[0]

    result = posting.unpost_journal(
        store, company_id=company["id"], user_id="u1", journal_id=entry["id"],
        reason="Posted by mistake",
    )
    assert result["unposted"] == entry["id"]

    assert store.list_journal_entries(company["id"]) == []
    assert store.get_ledger_transaction(txn["id"], company["id"])["status"] == "applied"

    # The transaction can be posted again.
    summary = posting.post_applied_transactions(store, company_id=company["id"], user_id="u1")
    assert summary["posted"] == 1

    with pytest.raises(KeyError):
        posting.unpost_journal(
            store, company_id=company["id"], user_id="u1", journal_id="missing"
        )


def test_unpost_resets_adjustment(store: Store, company: dict) -> None:
    adj = posting.create_adjustment(
        store, company_id=company["id"], user_id="u1", description="Accrual", amount=1000
    )
    entry = posting.approve_adjustment(
        store, company_id=company["id"], user_id="u1", adj_id=adj["id"],
        debit_code="6020", credit_code="2020",
    )
    posting.unpost_journal(
        store, company_id=company["id"], user_id="u1", journal_id=entry["id"]
    )
    updated = store.get_adjustment(adj["id"], company["id"])
    assert updated["approved_by"] is None
    assert updated["journal_id"] is None


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


@pytest.fixture(scope="module")
def post_headers(client) -> dict:
    return _auth_headers(client, "posting@bsi.local")


@pytest.fixture(scope="module")
def pdf_path():
    import pathlib
    import tempfile

    from tests.generators.make_statements import build_statement_pdf

    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    build_statement_pdf(pdf, bank="Zenith Bank", n_transactions=8, seed=17)
    return pdf


def test_api_posting_flow(client, post_headers, pdf_path) -> None:
    r = client.post(
        "/api/companies", json={"name": "Posting Co", "industry": "retail"}, headers=post_headers
    )
    assert r.status_code == 200, r.text
    company_id = r.json()["id"]

    period = client.post(
        f"/api/companies/{company_id}/periods",
        json={"name": "Jan 2026", "start_date": "2026-01-01", "end_date": "2026-01-31"},
        headers=post_headers,
    ).json()

    with pdf_path.open("rb") as fh:
        r = client.post(
            "/api/process", files={"upload": ("stmt.pdf", fh, "application/pdf")}, headers=post_headers
        )
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    for _ in range(100):
        status = client.get(f"/api/jobs/{job_id}", headers=post_headers).json()["status"]
        if status in ("completed", "failed"):
            break
        time.sleep(0.2)
    assert status == "completed"

    link = client.post(
        f"/api/companies/{company_id}/statements",
        json={"job_id": job_id, "period_id": period["id"]},
        headers=post_headers,
    )
    assert link.status_code == 200, link.text
    statement_id = link.json()["id"]

    classify = client.post(
        f"/api/companies/{company_id}/statements/{statement_id}/classify", headers=post_headers
    )
    assert classify.status_code == 200, classify.text

    # Approve everything in the review queue so posting has full coverage.
    queue = client.get(f"/api/companies/{company_id}/classifications", headers=post_headers).json()
    for txn in queue["transactions"]:
        client.post(
            f"/api/companies/{company_id}/classifications/{txn['id']}/approve",
            headers=post_headers,
        )

    # Post the statement into the period.
    run = client.post(
        f"/api/companies/{company_id}/posting/run",
        json={"period_id": period["id"]},
        headers=post_headers,
    )
    assert run.status_code == 200, run.text
    assert run.json()["posted"] == queue["total"]
    assert len(run.json()["journal_ids"]) == queue["total"]

    # Re-running is a no-op.
    run2 = client.post(
        f"/api/companies/{company_id}/posting/run", headers=post_headers
    )
    assert run2.json()["posted"] == 0

    # Journals are listed and readable, and every entry is balanced.
    journals = client.get(f"/api/companies/{company_id}/journals", headers=post_headers).json()
    assert journals["total"] == queue["total"]
    detail = client.get(
        f"/api/companies/{company_id}/journals/{journals['journals'][0]['id']}",
        headers=post_headers,
    ).json()
    assert len(detail["lines"]) == 2

    # Trial balance balances.
    tb = client.get(
        f"/api/companies/{company_id}/trial-balance?period_id={period['id']}",
        headers=post_headers,
    ).json()
    assert tb["balanced"] is True
    assert tb["total_debit"] > 0

    # Adjustments: create, approve, and they appear in the trial balance.
    adj = client.post(
        f"/api/companies/{company_id}/adjustments",
        json={"period_id": period["id"], "adj_type": "accrual",
              "description": "Accrue fees", "amount": 75000},
        headers=post_headers,
    )
    assert adj.status_code == 200, adj.text
    adj_id = adj.json()["id"]
    assert client.delete(
        f"/api/companies/{company_id}/adjustments/{adj_id}", headers=post_headers
    ).status_code == 200  # drafts can be deleted

    adj2 = client.post(
        f"/api/companies/{company_id}/adjustments",
        json={"period_id": period["id"], "adj_type": "correction",
              "description": "Correct fees", "amount": 25000},
        headers=post_headers,
    ).json()
    approved = client.post(
        f"/api/companies/{company_id}/adjustments/{adj2['id']}/approve",
        json={"debit_code": "6110", "credit_code": "2010"},
        headers=post_headers,
    )
    assert approved.status_code == 200, approved.text

    # Reverse the adjustment journal.
    reverse = client.post(
        f"/api/companies/{company_id}/journals/{approved.json()['id']}/reverse",
        json={"reason": "Wrong amount"},
        headers=post_headers,
    )
    assert reverse.status_code == 200, reverse.text
    assert client.get(
        f"/api/companies/{company_id}/journals/{approved.json()['id']}",
        headers=post_headers,
    ).status_code == 404

    # Locking the period then posting into it is refused (even adjustments).
    client.post(
        f"/api/companies/{company_id}/periods/{period['id']}/lock",
        json={"reason": "Closing"}, headers=post_headers,
    )
    locked_run = client.post(
        f"/api/companies/{company_id}/posting/run",
        json={"period_id": period["id"]},
        headers=post_headers,
    )
    assert locked_run.status_code == 400
    locked_adj = client.post(
        f"/api/companies/{company_id}/adjustments",
        json={"period_id": period["id"], "adj_type": "manual",
              "description": "Too late", "amount": 100},
        headers=post_headers,
    )
    assert locked_adj.status_code == 400

    # Security: a foreign user sees none of this.
    other = _auth_headers(client, "posting-other@bsi.local")
    assert client.get(f"/api/companies/{company_id}/journals", headers=other).status_code == 404
    assert client.get(f"/api/companies/{company_id}/trial-balance", headers={}).status_code == 401

    client.delete(f"/api/companies/{company_id}", headers=post_headers)
