"""Statement linking.

Attaches a processed bank statement (a completed job from the Layer 1 engine)
to a company, optionally to a specific bank account and accounting period.
The original data is never rewritten: linking only records the relationship,
and every link is audit logged.
"""

from __future__ import annotations

from typing import Optional

from app.accounting import audit


def link_statement(
    store,
    jobs,
    *,
    company_id: str,
    user_id: str,
    job_id: str,
    bank_account_id: Optional[str] = None,
    period_id: Optional[str] = None,
) -> dict:
    company = store.get_company(company_id, user_id)
    if company is None:
        raise KeyError("Company not found.")
    job = jobs.get(job_id, user_id=user_id)
    if job is None:
        raise KeyError("Statement job not found.")
    if job.get("status") != "completed":
        raise ValueError("Statement has not finished processing yet.")
    if bank_account_id and store.get_bank_account(bank_account_id, company_id) is None:
        raise KeyError("Bank account not found.")
    if period_id and store.get_period(period_id, company_id) is None:
        raise KeyError("Accounting period not found.")

    linked = store.link_statement(
        company_id=company_id,
        user_id=user_id,
        job_id=job_id,
        bank_account_id=bank_account_id,
        period_id=period_id,
    )
    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="statement.link",
        entity="company_statements",
        entity_id=linked["id"],
        new_value={"job_id": job_id, "bank_account_id": bank_account_id, "period_id": period_id},
    )
    return linked


def unlink_statement(
    store, *, company_id: str, user_id: str, statement_id: str
) -> bool:
    """Remove a company statement record (audited)."""
    statement = store.get_company_statement(statement_id, company_id)
    if statement is None:
        return False
    removed = store.delete_company_statement(statement_id, company_id)
    if removed:
        audit.log(
            store,
            company_id=company_id,
            user_id=user_id,
            action="statement.unlink",
            entity="company_statements",
            entity_id=statement_id,
            old_value={"job_id": statement.get("job_id")},
        )
    return removed


def enrich_statements(store, statements: list[dict]) -> list[dict]:
    """Attach job metadata (filename, bank, period) to statement rows."""
    out = []
    for statement in statements:
        row = dict(statement)
        row["job_meta"] = _job_meta(store, statement.get("job_id"))
        row["bank_account"] = (
            store.get_bank_account(statement["bank_account_id"], statement["company_id"])
            if statement.get("bank_account_id")
            else None
        )
        row["period"] = (
            store.get_period(statement["period_id"], statement["company_id"])
            if statement.get("period_id")
            else None
        )
        out.append(row)
    return out


def _job_meta(store, job_id) -> Optional[dict]:
    if not job_id:
        return None
    job = store.get_job(job_id)
    if not job:
        return None
    meta = {}
    try:
        import json

        meta = json.loads(job.get("meta_json") or "{}")
    except (ValueError, TypeError):
        meta = {}
    return {
        "filename": job.get("filename"),
        "status": job.get("status"),
        "bank_name": meta.get("bank_name"),
        "account_name": meta.get("account_name"),
        "account_number": meta.get("account_number"),
        "period_start": meta.get("period_start"),
        "period_end": meta.get("period_end"),
    }
