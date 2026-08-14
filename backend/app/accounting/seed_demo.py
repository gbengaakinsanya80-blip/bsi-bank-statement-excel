"""Demo data seeding (PRD "try it" flow).

Builds a complete, realistic small company in one call so the Ledger and
Reports pages have real content immediately: company, chart of accounts,
an open accounting period, a bank account, a linked statement, applied
ledger transactions and their posted journal entries, plus an opening
capital adjustment so the balance sheet ties.
"""

from __future__ import annotations

from app.accounting import coa, posting

DEMO_NAME = "Demo Trading Co."
DEMO_BANK = "Zenith Bank"
DEMO_ACCOUNT_NUMBER = "0123456789"
DEMO_JOB_ID = "demo-statement-2026-07"

BANK_CODE = "1010"
SHARE_CAPITAL_CODE = "3010"


def seed_demo_company(store, *, user_id: str) -> dict:
    """Create (or reuse) a demo company with posted journals for the user.

    Returns a dict describing the company and what was seeded.
    """
    existing = _existing_demo(store, user_id)
    if existing:
        return {
            "created": False,
            "company": existing,
            "posted": 0,
            "skipped": 0,
            "message": f"{existing['name']} already exists; using it as-is.",
        }

    company = store.create_company(
        user_id=user_id,
        name=DEMO_NAME,
        trading_name="Demo Trading Co.",
        country="Nigeria",
        currency="NGN",
        industry="trading",
        accounting_basis="cash",
        financial_year_end="2026-12-31",
        opening_date="2026-07-01",
    )
    store.replace_chart_of_accounts(company["id"], coa.generate_default_coa("trading"))

    period = store.create_period(
        company["id"],
        name="July 2026",
        start_date="2026-07-01",
        end_date="2026-07-31",
        status="open",
    )
    bank = store.create_bank_account(
        company["id"],
        name="Operating Account",
        bank_name=DEMO_BANK,
        account_number=DEMO_ACCOUNT_NUMBER,
        currency="NGN",
    )
    statement = store.link_statement(
        company_id=company["id"],
        user_id=user_id,
        job_id=DEMO_JOB_ID,
        bank_account_id=bank["id"],
        period_id=period["id"],
    )
    store.import_ledger_transactions(
        company_id=company["id"],
        statement_id=statement["id"],
        job_id=DEMO_JOB_ID,
        rows=_demo_transactions(),
    )

    summary = posting.post_applied_transactions(
        store, company_id=company["id"], user_id=user_id, period_id=period["id"]
    )

    opening = posting.create_adjustment(
        store,
        company_id=company["id"],
        user_id=user_id,
        period_id=period["id"],
        adj_type="correction",
        description="Opening share capital introduced",
        amount=5_000_000.0,
    )
    posting.approve_adjustment(
        store,
        company_id=company["id"],
        user_id=user_id,
        adj_id=opening["id"],
        debit_code=BANK_CODE,
        credit_code=SHARE_CAPITAL_CODE,
        date="2026-07-01",
    )

    return {
        "created": True,
        "company": store.get_company(company["id"], user_id),
        "period": period,
        "bank_account": bank,
        "posted": summary["posted"],
        "skipped": summary["skipped"],
        "message": f"{DEMO_NAME} seeded with {summary['posted']} posted transactions.",
    }


def _existing_demo(store, user_id: str) -> dict | None:
    for company in store.list_companies(user_id):
        if company.get("name") == DEMO_NAME:
            return company
    return None


def _demo_transactions() -> list[dict]:
    """Realistic July 2026 bank statement rows for a trading company.

    Sales receipts credit the bank (credit rows); purchases and expenses
    debit the bank (debit rows). Each row is posted by the engine against
    the 1010 bank account.
    """
    rows: list[dict] = []

    def add(day: int, description: str, *, debit: float = 0.0, credit: float = 0.0, code: str = "4010") -> None:
        rows.append(
            {
                "tx_date": f"2026-07-{day:02d}",
                "description": description,
                "reference": "",
                "debit": debit,
                "credit": credit,
                "balance": 0.0,
                "category": "",
                "account_code": code,
                "transaction_type": "debit" if debit else "credit",
                "confidence": 1.0,
                "rationale": "Seeded demo transaction.",
                "status": "applied",
                "source": "demo",
                "source_page": 1,
            }
        )

    add(2, "Cash sale - walk-in customers", credit=850_000.0)
    add(3, "Stock purchase - supplier invoice SUP-2107", debit=780_000.0, code="5010")
    add(4, "Office rent for July - Landlord", debit=350_000.0, code="6020")
    add(6, "Cash sale - walk-in customers", credit=1_250_000.0)
    add(7, "Salaries for July payroll", debit=480_000.0, code="6010")
    add(10, "Stock purchase - supplier invoice SUP-2113", debit=520_000.0, code="5010")
    add(11, "PHCN electricity bill", debit=95_000.0, code="6030")
    add(13, "Cash sale - walk-in customers", credit=620_000.0)
    add(14, "Internet subscription", debit=45_000.0, code="6050")
    add(17, "Stock purchase - supplier invoice SUP-2121", debit=690_000.0, code="5010")
    add(18, "Advert on local radio", debit=120_000.0, code="6120")
    add(20, "Cash sale - walk-in customers", credit=940_000.0)
    add(22, "Diesel for delivery van", debit=60_000.0, code="6080")
    add(25, "Audit fees - Kwesi & Partners", debit=200_000.0, code="6110")
    add(27, "Cash sale - walk-in customers", credit=1_100_000.0)
    add(29, "Bank service charges for July", debit=15_000.0, code="6070")

    return rows
