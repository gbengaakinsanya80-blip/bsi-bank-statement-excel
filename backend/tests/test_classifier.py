"""Classification engine tests: deterministic classifier, review queue, rules, AI memory.

Covers Phase 2 of the FinancePilot AI build: deterministic-first AI
classification, the accountant review queue, reclassification learning
(ai_memory) and user-defined classification rules.
"""

from __future__ import annotations

import time

import pytest

from app.accounting import classifier
from app.accounting.classifier import (
    REVIEW_THRESHOLD,
    CATEGORY_MAP,
    normalize_description,
)
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


# ---------------------------------------------------------------------- #
# Fingerprint + category mapping
# ---------------------------------------------------------------------- #
def test_normalize_description() -> None:
    assert normalize_description("  POS   PURCHASE  SHOPRITE ") == "pos purchase shoprite"
    assert normalize_description("REF 12345678 AIRTIME") == "airtime"


def test_category_map_covers_every_category_code_exists() -> None:
    coa_codes = {a["code"] for a in generate_default_coa()}
    for category, (debit, credit) in CATEGORY_MAP.items():
        for code in (debit, credit):
            if code is not None:
                assert code in coa_codes, f"{category} references unknown code {code}"


# ---------------------------------------------------------------------- #
# Deterministic classification
# ---------------------------------------------------------------------- #
def test_classify_deterministic_salary(store: Store, company: dict) -> None:
    debit = classifier.classify_transaction(
        store, company, description="SALARY PAYMENT", debit=500000
    )
    assert debit.account_code == "6010"
    assert debit.category == "Salary"
    assert debit.source == "categorizer"

    credit = classifier.classify_transaction(
        store, company, description="SALARY PAYMENT", credit=500000
    )
    assert credit.account_code == "6010"


def test_classify_direction_aware(store: Store, company: dict) -> None:
    interest = classifier.classify_transaction(
        store, company, description="INTEREST EARNED ON SAVINGS", credit=500
    )
    assert interest.account_code == "4050"

    charges = classifier.classify_transaction(
        store, company, description="INTEREST PAID ON LOAN", debit=1200
    )
    assert charges.account_code == "6070"


def test_classify_bill_refinements(store: Store, company: dict) -> None:
    assert (
        classifier.classify_transaction(store, company, description="EKEDC PREPAID ELECTRICITY", debit=10).account_code
        == "6030"
    )
    assert (
        classifier.classify_transaction(store, company, description="MTN DATA AIRTIME", debit=10).account_code
        == "6060"
    )
    assert (
        classifier.classify_transaction(store, company, description="WATER BILL", debit=10).account_code
        == "6040"
    )


def test_classify_unknown_is_review(store: Store, company: dict) -> None:
    result = classifier.classify_transaction(
        store, company, description="XYZZY UNKNOWN MERCHANT 9999", debit=100
    )
    assert result.account_code == "1200"
    assert result.source == "categorizer"
    assert result.confidence < REVIEW_THRESHOLD


# ---------------------------------------------------------------------- #
# User rules override the defaults
# ---------------------------------------------------------------------- #
def test_classification_rule_overrides(store: Store, company: dict) -> None:
    store.create_classification_rule(
        company["id"], name="Shoprite sales", match_type="contains",
        match_value="shoprite", account_code="4010",
    )
    result = classifier.classify_transaction(
        store, company, description="POS PURCHASE SHOPRITE ABUJA", debit=15000
    )
    assert result.account_code == "4010"
    assert result.source == "rule"
    assert result.confidence == 0.95


def test_rule_exact_and_regex(store: Store, company: dict) -> None:
    store.create_classification_rule(
        company["id"], name="exact", match_type="exact",
        match_value="DSTV SUBSCRIPTION", account_code="6060",
    )
    assert (
        classifier.classify_transaction(store, company, description="DSTV SUBSCRIPTION", debit=1).account_code
        == "6060"
    )
    store.create_classification_rule(
        company["id"], name="regex", match_type="regex",
        match_value=r"^PAY[\s-]*ONE", account_code="6070",
    )
    assert (
        classifier.classify_transaction(store, company, description="PAY-ONE CUSTOMER", credit=1).account_code
        == "6070"
    )


# ---------------------------------------------------------------------- #
# AI memory learning
# ---------------------------------------------------------------------- #
def test_memory_learns_and_reapplies(store: Store, company: dict) -> None:
    description = "WEIRD UNKNOWN MERCHANT XYZ"
    first = classifier.classify_transaction(store, company, description=description, debit=100)
    assert first.confidence < REVIEW_THRESHOLD

    classifier.remember(
        store, company_id=company["id"], description=description,
        account_code="6160", category="Software Subscriptions",
    )
    memory = store.list_ai_memory(company["id"])
    assert len(memory) == 1
    assert memory[0]["account_code"] == "6160"
    assert memory[0]["times_seen"] == 1

    second = classifier.classify_transaction(store, company, description=description, debit=100)
    assert second.account_code == "6160"
    assert second.source == "memory"
    assert second.confidence == 0.95

    # Teaching the same fingerprint again bumps times_seen.
    classifier.remember(
        store, company_id=company["id"], description=description, account_code="6160"
    )
    assert store.list_ai_memory(company["id"])[0]["times_seen"] == 2


def test_memory_delete(store: Store, company: dict) -> None:
    classifier.remember(store, company_id=company["id"], description="SOMETHING ODD", account_code="1200")
    mid = store.list_ai_memory(company["id"])[0]["id"]
    assert store.delete_ai_memory(mid, company["id"]) is True
    assert store.list_ai_memory(company["id"]) == []
    assert store.delete_ai_memory(mid, company["id"]) is False


# ---------------------------------------------------------------------- #
# Statement import + classification (store level)
# ---------------------------------------------------------------------- #
class _FakeJobs:
    def __init__(self, job: dict, result: dict) -> None:
        self._job = job
        self._result = result

    def get(self, job_id: str, user_id: str | None = None) -> dict | None:
        return self._job if self._job and self._job["id"] == job_id else None

    def get_result(self, job_id: str, user_id: str | None = None) -> dict | None:
        return self._result if self._job and self._job["id"] == job_id else None


def _sample_result() -> dict:
    return {
        "transactions": [
            {
                "date": "2026-01-01", "description": "Opening Balance", "reference": "",
                "debit": None, "credit": None, "balance": 100000,
                "transaction_type": "Balance", "page_number": 1,
                "is_beginning_balance": True, "is_ending_balance": False,
            },
            {
                "date": "2026-01-05", "description": "SALARY PAYMENT", "reference": "R1",
                "debit": None, "credit": 500000, "balance": 600000,
                "transaction_type": "Credit", "page_number": 1,
                "is_beginning_balance": False, "is_ending_balance": False,
            },
            {
                "date": "2026-01-06", "description": "POS PURCHASE SHOPRITE ABUJA", "reference": "R2",
                "debit": 15000, "credit": None, "balance": 585000,
                "transaction_type": "Debit", "page_number": 1,
                "is_beginning_balance": False, "is_ending_balance": False,
            },
            {
                "date": "2026-01-07", "description": "CUSTOMER PAYMENT INVOICE XYZ", "reference": "R3",
                "debit": None, "credit": 250000, "balance": 835000,
                "transaction_type": "Credit", "page_number": 1,
                "is_beginning_balance": False, "is_ending_balance": False,
            },
            {
                "date": "2026-01-08", "description": "RTGS INWARD CLEARING FUNDS", "reference": "R4",
                "debit": None, "credit": 50000, "balance": 885000,
                "transaction_type": "Credit", "page_number": 1,
                "is_beginning_balance": False, "is_ending_balance": False,
            },
            {
                "date": "2026-01-31", "description": "Closing Balance", "reference": "",
                "debit": None, "credit": None, "balance": 585000,
                "transaction_type": "Balance", "page_number": 1,
                "is_beginning_balance": False, "is_ending_balance": True,
            },
        ]
    }


def test_import_and_classify_statement(store: Store, company: dict) -> None:
    store.save_job("j1", "stmt.pdf", "completed", user_id="u1")
    linked = store.link_statement(company_id=company["id"], user_id="u1", job_id="j1")
    fake = _FakeJobs({"id": "j1", "status": "completed"}, _sample_result())

    summary = classifier.import_and_classify_statement(
        store, fake, company_id=company["id"], user_id="u1", statement_id=linked["id"]
    )
    assert summary["imported"] == 5  # opening balance now imports into the ledger
    assert summary["auto"] == 4      # opening balance + salary, shoprite, customer
    assert summary["review"] == 1    # RTGS inward transfer: ambiguous

    rows = store.list_ledger_transactions(company["id"])
    assert len(rows) == 5
    by_desc = {r["description"]: r for r in rows}
    assert by_desc["CUSTOMER PAYMENT INVOICE XYZ"]["status"] == "applied"
    assert by_desc["CUSTOMER PAYMENT INVOICE XYZ"]["account_code"] == "4010"
    assert by_desc["POS PURCHASE SHOPRITE ABUJA"]["status"] == "applied"
    assert by_desc["POS PURCHASE SHOPRITE ABUJA"]["account_code"] == "5010"
    assert by_desc["SALARY PAYMENT"]["status"] == "applied"
    assert by_desc["SALARY PAYMENT"]["source"] == "categorizer"
    assert by_desc["RTGS INWARD CLEARING FUNDS"]["status"] == "review"
    assert by_desc["RTGS INWARD CLEARING FUNDS"]["account_code"] == "1200"
    opening = by_desc["Opening Balance"]
    assert opening["account_code"] == "3020"
    assert opening["transaction_type"] == "opening_balance"
    assert opening["status"] == "applied"
    assert opening["debit"] == 100000

    # Idempotent: re-classifying replaces rows, no duplicates.
    summary2 = classifier.import_and_classify_statement(
        store, fake, company_id=company["id"], user_id="u1", statement_id=linked["id"]
    )
    assert summary2["imported"] == 5
    assert len(store.list_ledger_transactions(company["id"])) == 5

    # Review actions.
    pending = store.list_ledger_transactions(company["id"], status="review")
    txn_id = pending[0]["id"]
    updated = store.update_ledger_transaction(
        txn_id, company["id"], status="applied", source="manual", confidence=1.0
    )
    assert updated["status"] == "applied"
    assert store.get_ledger_transaction(txn_id, "other-company") is None


def test_import_requires_result(store: Store, company: dict) -> None:
    store.save_job("j1", "stmt.pdf", "completed", user_id="u1")
    linked = store.link_statement(company_id=company["id"], user_id="u1", job_id="j1")
    fake = _FakeJobs({"id": "j1", "status": "completed"}, None)
    with pytest.raises(ValueError):
        classifier.import_and_classify_statement(
            store, fake, company_id=company["id"], user_id="u1", statement_id=linked["id"]
        )


# ---------------------------------------------------------------------- #
# Store CRUD for rules + ledger transactions
# ---------------------------------------------------------------------- #
def test_rule_store_crud(store: Store, company: dict) -> None:
    rule = store.create_classification_rule(
        company["id"], name="Uber", match_type="contains", match_value="uber", account_code="6130"
    )
    assert rule["enabled"] == 1
    assert len(store.list_classification_rules(company["id"])) == 1

    updated = store.update_classification_rule(rule["id"], company["id"], enabled=False)
    assert updated["enabled"] == 0
    assert store.get_classification_rule(rule["id"], "other") is None

    assert store.delete_classification_rule(rule["id"], company["id"]) is True
    assert store.list_classification_rules(company["id"]) == []


def test_ledger_transaction_update(store: Store, company: dict) -> None:
    store.save_job("j1", "stmt.pdf", "completed", user_id="u1")
    linked = store.link_statement(company_id=company["id"], user_id="u1", job_id="j1")
    store.import_ledger_transactions(
        company_id=company["id"], statement_id=linked["id"], job_id="j1",
        rows=[{
            "row_index": 0, "tx_date": "2026-01-05", "description": "TEST TXN",
            "reference": "R", "debit": 10.0, "credit": None, "balance": 90.0,
            "category": "Other", "account_code": "1200", "transaction_type": "Debit",
            "confidence": 0.25, "rationale": "x", "status": "review", "source": "categorizer",
        }],
    )
    rows = store.list_ledger_transactions(company["id"], status="review")
    assert len(rows) == 1
    txn = store.get_ledger_transaction(rows[0]["id"], company["id"])
    assert txn["debit"] == 10.0
    assert store.list_ledger_transactions(company["id"], status="applied") == []


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
def cls_headers(client) -> dict:
    return _auth_headers(client, "classifier@bsi.local")


@pytest.fixture(scope="module")
def pdf_path():
    import pathlib
    import tempfile

    from tests.generators.make_statements import build_statement_pdf

    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    build_statement_pdf(pdf, bank="Access Bank", n_transactions=8, seed=11)
    return pdf


def test_api_classify_flow(client, cls_headers, pdf_path) -> None:
    r = client.post(
        "/api/companies",
        json={"name": "Kaltua API", "industry": "retail"},
        headers=cls_headers,
    )
    assert r.status_code == 200, r.text
    company_id = r.json()["id"]

    with pdf_path.open("rb") as fh:
        r = client.post(
            "/api/process", files={"upload": ("stmt.pdf", fh, "application/pdf")}, headers=cls_headers
        )
    assert r.status_code == 200
    job_id = r.json()["job_id"]
    for _ in range(100):
        status = client.get(f"/api/jobs/{job_id}", headers=cls_headers).json()["status"]
        if status in ("completed", "failed"):
            break
        time.sleep(0.2)
    assert status == "completed"

    bank = client.post(
        f"/api/companies/{company_id}/bank-accounts",
        json={"name": "Main", "bank_name": "Access"},
        headers=cls_headers,
    ).json()
    link = client.post(
        f"/api/companies/{company_id}/statements",
        json={"job_id": job_id, "bank_account_id": bank["id"]},
        headers=cls_headers,
    )
    assert link.status_code == 200, link.text
    statement_id = link.json()["id"]

    # Classify the statement.
    r = client.post(
        f"/api/companies/{company_id}/statements/{statement_id}/classify", headers=cls_headers
    )
    assert r.status_code == 200, r.text
    summary = r.json()
    assert summary["imported"] > 0

    queue = client.get(f"/api/companies/{company_id}/classifications", headers=cls_headers).json()
    assert queue["total"] == summary["imported"]

    # Suggest endpoint is read-only.
    suggest = client.post(
        f"/api/companies/{company_id}/classify/suggest",
        json={"description": "POS PURCHASE SHOPRITE ABUJA", "debit": 1000},
        headers=cls_headers,
    )
    assert suggest.status_code == 200
    assert "account_code" in suggest.json()
    assert suggest.json()["account_name"] is not None

    # Approve / reclassify / reject entries in the queue.
    txn = queue["transactions"][0]
    appr = client.post(
        f"/api/companies/{company_id}/classifications/{txn['id']}/approve", headers=cls_headers
    )
    assert appr.status_code == 200, appr.text
    assert appr.json()["status"] == "applied"

    reclass = client.post(
        f"/api/companies/{company_id}/classifications/{txn['id']}/reclassify",
        json={"account_code": "6140", "category": "Office Expenses", "save_as_rule": True},
        headers=cls_headers,
    )
    assert reclass.status_code == 200, reclass.text
    assert reclass.json()["account_code"] == "6140"
    assert reclass.json()["source"] == "manual"

    # Reclassifying to a foreign account code is rejected.
    bad = client.post(
        f"/api/companies/{company_id}/classifications/{txn['id']}/reclassify",
        json={"account_code": "9999"},
        headers=cls_headers,
    )
    assert bad.status_code == 422

    rej = client.post(
        f"/api/companies/{company_id}/classifications/{txn['id']}/reject", headers=cls_headers
    )
    assert rej.status_code == 200
    assert rej.json()["status"] == "rejected"

    # Rules CRUD via API.
    rule = client.post(
        f"/api/companies/{company_id}/classification-rules",
        json={"name": "Airport", "match_type": "contains", "match_value": "airport", "account_code": "6130"},
        headers=cls_headers,
    )
    assert rule.status_code == 200, rule.text
    rule_id = rule.json()["id"]
    assert client.put(
        f"/api/companies/{company_id}/classification-rules/{rule_id}",
        json={"enabled": False},
        headers=cls_headers,
    ).status_code == 200
    assert client.delete(
        f"/api/companies/{company_id}/classification-rules/{rule_id}", headers=cls_headers
    ).status_code == 200

    # AI memory was taught by the reclassification.
    memory = client.get(f"/api/companies/{company_id}/ai-memory", headers=cls_headers).json()["memory"]
    assert memory, "reclassification should have taught ai_memory"
    mid = memory[0]["id"]
    assert client.delete(
        f"/api/companies/{company_id}/ai-memory/{mid}", headers=cls_headers
    ).status_code == 200

    # Classifications require auth + company ownership.
    assert client.get(
        f"/api/companies/{company_id}/classifications", headers={}
    ).status_code == 401
    other = _auth_headers(client, "classifier-other@bsi.local")
    assert client.get(
        f"/api/companies/{company_id}/classifications", headers=other
    ).status_code == 404

    client.delete(f"/api/companies/{company_id}", headers=cls_headers)
