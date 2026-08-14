"""FinancePilot AI accounting foundation routes.

Companies, chart of accounts, accounting periods, bank accounts and
statement linking. Every mutation is audit logged and every lookup is
scoped to the authenticated user.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import Response

from app.accounting import audit as audit_log
from app.accounting import classifier, coa, linking, periods, posting, report_pdf, report_xlsx, seed_demo, statements
from app.auth.deps import get_current_user
from app.export.sqlite_store import Store
from app.services.jobs import JobManager

VALID_BASIS = ("cash", "accrual")


def build_accounting_router(jobs: JobManager, store: Store) -> APIRouter:
    router = APIRouter()

    # ------------------------------------------------------------------ #
    # Companies
    # ------------------------------------------------------------------ #
    @router.post("/demo/seed")
    def seed_demo_company(user: dict = Depends(get_current_user)) -> dict:
        """Create a fully-populated demo company (COA, period, posted journals)."""
        return seed_demo.seed_demo_company(store, user_id=user["id"])

    @router.post("/companies")
    def create_company(
        payload: dict = Body(...),
        generate_coa: bool = Query(True),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _require(payload, "name")
        industry = _s(payload.get("industry")) or "general"
        if industry not in coa.INDUSTRIES:
            raise HTTPException(422, f"industry must be one of {sorted(coa.INDUSTRIES)}")
        basis = _s(payload.get("accounting_basis")) or "cash"
        if basis not in VALID_BASIS:
            raise HTTPException(422, "accounting_basis must be 'cash' or 'accrual'")
        company = store.create_company(
            user_id=user["id"],
            name=_s(payload["name"]),
            trading_name=_s(payload.get("trading_name")),
            reg_number=_s(payload.get("reg_number")),
            country=_s(payload.get("country")) or "Nigeria",
            currency=_s(payload.get("currency")) or "NGN",
            industry=industry,
            accounting_basis=basis,
            financial_year_end=_s(payload.get("financial_year_end")),
            opening_date=_s(payload.get("opening_date")),
        )
        if generate_coa:
            _ensure_coa(store, company, user["id"])
        return company

    @router.get("/companies")
    def list_companies(user: dict = Depends(get_current_user)) -> dict:
        return {"companies": store.list_companies(user["id"])}

    @router.get("/companies/{company_id}")
    def get_company(company_id: str, user: dict = Depends(get_current_user)) -> dict:
        return _company(store, company_id, user["id"])

    @router.put("/companies/{company_id}")
    def update_company(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        before = _company(store, company_id, user["id"])
        if "industry" in payload:
            industry = _s(payload.get("industry"))
            if industry not in coa.INDUSTRIES:
                raise HTTPException(422, f"industry must be one of {sorted(coa.INDUSTRIES)}")
        if "accounting_basis" in payload:
            basis = _s(payload.get("accounting_basis"))
            if basis not in VALID_BASIS:
                raise HTTPException(422, "accounting_basis must be 'cash' or 'accrual'")
        updated = store.update_company(company_id, user["id"], **payload)
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="company.update",
            entity="companies",
            entity_id=company_id,
            old_value=_pick(before, payload),
            new_value=_pick(updated, payload),
        )
        return updated

    @router.delete("/companies/{company_id}")
    def delete_company(company_id: str, user: dict = Depends(get_current_user)) -> dict:
        if not store.delete_company(company_id, user["id"]):
            raise HTTPException(404, "Company not found.")
        return {"deleted": company_id}

    # ------------------------------------------------------------------ #
    # Chart of accounts
    # ------------------------------------------------------------------ #
    @router.get("/companies/{company_id}/chart-of-accounts")
    def list_chart_of_accounts(
        company_id: str, user: dict = Depends(get_current_user)
    ) -> dict:
        _company(store, company_id, user["id"])
        return {"accounts": store.list_chart_of_accounts(company_id)}

    @router.post("/companies/{company_id}/coa/generate")
    def generate_coa(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        company = _company(store, company_id, user["id"])
        if not payload.get("confirm"):
            raise HTTPException(422, "Pass {confirm: true} to replace the existing COA.")
        accounts = coa.generate_default_coa(company.get("industry"))
        store.replace_chart_of_accounts(company_id, accounts)
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="coa.generated",
            entity="chart_of_accounts",
            entity_id=company_id,
            new_value={"count": len(accounts), "industry": company.get("industry")},
        )
        return {"accounts": accounts}

    @router.post("/companies/{company_id}/chart-of-accounts")
    def add_chart_account(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        _require(payload, "code")
        _require(payload, "name")
        _require(payload, "account_type")
        _require(payload, "normal_balance")
        if payload["account_type"] not in coa.ACCOUNT_TYPES:
            raise HTTPException(422, f"account_type must be one of {coa.ACCOUNT_TYPES}")
        if payload["normal_balance"] not in ("debit", "credit"):
            raise HTTPException(422, "normal_balance must be 'debit' or 'credit'")
        account = store.add_chart_account(
            company_id,
            code=str(payload["code"]).strip(),
            name=str(payload["name"]).strip(),
            account_type=str(payload["account_type"]).strip(),
            normal_balance=str(payload["normal_balance"]).strip(),
            parent_code=_s(payload.get("parent_code")),
            is_system=bool(payload.get("is_system", False)),
        )
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="coa.account_added",
            entity="chart_of_accounts",
            entity_id=account["id"],
            new_value=_pick(account, ("code", "name", "account_type", "normal_balance")),
        )
        return account

    @router.put("/companies/{company_id}/chart-of-accounts/{account_id}")
    def update_chart_account(
        company_id: str,
        account_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if store.get_chart_account(account_id, company_id) is None:
            raise HTTPException(404, "Account not found.")
        if "account_type" in payload and payload["account_type"] not in coa.ACCOUNT_TYPES:
            raise HTTPException(422, f"account_type must be one of {coa.ACCOUNT_TYPES}")
        if "normal_balance" in payload and payload["normal_balance"] not in ("debit", "credit"):
            raise HTTPException(422, "normal_balance must be 'debit' or 'credit'")
        updated = store.update_chart_account(account_id, company_id, **payload)
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="coa.account_updated",
            entity="chart_of_accounts",
            entity_id=account_id,
            new_value=_pick(updated, tuple(payload.keys())),
        )
        return updated

    @router.delete("/companies/{company_id}/chart-of-accounts/{account_id}")
    def delete_chart_account(
        company_id: str,
        account_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if not store.delete_chart_account(account_id, company_id):
            raise HTTPException(404, "Account not found.")
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="coa.account_deleted",
            entity="chart_of_accounts",
            entity_id=account_id,
        )
        return {"deleted": account_id}

    # ------------------------------------------------------------------ #
    # Accounting periods
    # ------------------------------------------------------------------ #
    @router.get("/companies/{company_id}/periods")
    def list_periods(company_id: str, user: dict = Depends(get_current_user)) -> dict:
        _company(store, company_id, user["id"])
        return {"periods": store.list_periods(company_id)}

    @router.post("/companies/{company_id}/periods")
    def create_period(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        _require(payload, "name")
        _require(payload, "start_date")
        _require(payload, "end_date")
        status = _s(payload.get("status")) or "open"
        if status not in periods.STATUSES:
            raise HTTPException(422, f"status must be one of {periods.STATUSES}")
        period = store.create_period(
            company_id,
            name=str(payload["name"]).strip(),
            start_date=str(payload["start_date"]).strip(),
            end_date=str(payload["end_date"]).strip(),
            status=status,
        )
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="period.created",
            entity="accounting_periods",
            entity_id=period["id"],
            new_value=_pick(period, ("name", "start_date", "end_date", "status")),
        )
        return period

    @router.put("/companies/{company_id}/periods/{period_id}")
    def update_period(
        company_id: str,
        period_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if store.get_period(period_id, company_id) is None:
            raise HTTPException(404, "Accounting period not found.")
        if payload.get("status"):
            try:
                return periods.transition_period(
                    store,
                    company_id=company_id,
                    user_id=user["id"],
                    period_id=period_id,
                    new_status=str(payload["status"]),
                    reason=_s(payload.get("reason")),
                )
            except ValueError as exc:
                raise HTTPException(400, str(exc)) from exc
        fields = {k: v for k, v in payload.items() if k in {"name", "start_date", "end_date"} and v is not None}
        if not fields:
            raise HTTPException(400, "No updatable fields provided.")
        before = store.get_period(period_id, company_id)
        updated = store.update_period(period_id, company_id, **fields)
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="period.update",
            entity="accounting_periods",
            entity_id=period_id,
            old_value=_pick(before, fields),
            new_value=_pick(updated, fields),
        )
        return updated

    @router.post("/companies/{company_id}/periods/{period_id}/lock")
    def lock_period(
        company_id: str,
        period_id: str,
        payload: dict = Body(default={}),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        try:
            return periods.lock_period(
                store,
                company_id=company_id,
                user_id=user["id"],
                period_id=period_id,
                reason=_s(payload.get("reason")) if payload else None,
            )
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    # ------------------------------------------------------------------ #
    # Bank accounts
    # ------------------------------------------------------------------ #
    @router.get("/companies/{company_id}/bank-accounts")
    def list_bank_accounts(company_id: str, user: dict = Depends(get_current_user)) -> dict:
        _company(store, company_id, user["id"])
        return {"bank_accounts": store.list_bank_accounts(company_id)}

    @router.post("/companies/{company_id}/bank-accounts")
    def create_bank_account(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        _require(payload, "name")
        account = store.create_bank_account(
            company_id,
            name=str(payload["name"]).strip(),
            bank_name=_s(payload.get("bank_name")) or "",
            account_number=_s(payload.get("account_number")) or "",
            currency=_s(payload.get("currency")) or "NGN",
        )
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="bank_account.created",
            entity="bank_accounts",
            entity_id=account["id"],
            new_value=_pick(account, ("name", "bank_name", "account_number", "currency")),
        )
        return account

    @router.delete("/companies/{company_id}/bank-accounts/{bank_account_id}")
    def delete_bank_account(
        company_id: str,
        bank_account_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if not store.delete_bank_account(bank_account_id, company_id):
            raise HTTPException(404, "Bank account not found.")
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="bank_account.deleted",
            entity="bank_accounts",
            entity_id=bank_account_id,
        )
        return {"deleted": bank_account_id}

    # ------------------------------------------------------------------ #
    # Statement linking
    # ------------------------------------------------------------------ #
    @router.post("/companies/{company_id}/statements")
    def link_statement(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _require(payload, "job_id")
        try:
            linked = linking.link_statement(
                store,
                jobs,
                company_id=company_id,
                user_id=user["id"],
                job_id=str(payload["job_id"]),
                bank_account_id=_s(payload.get("bank_account_id")),
                period_id=_s(payload.get("period_id")),
            )
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        return linked

    @router.get("/companies/{company_id}/statements")
    def list_statements(company_id: str, user: dict = Depends(get_current_user)) -> dict:
        _company(store, company_id, user["id"])
        statements = linking.enrich_statements(store, store.list_company_statements(company_id))
        return {"statements": statements}

    @router.delete("/companies/{company_id}/statements/{statement_id}")
    def unlink_statement(
        company_id: str,
        statement_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if not linking.unlink_statement(
            store, company_id=company_id, user_id=user["id"], statement_id=statement_id
        ):
            raise HTTPException(404, "Statement link not found.")
        return {"deleted": statement_id}

    # ------------------------------------------------------------------ #
    # Classification & review queue
    # ------------------------------------------------------------------ #
    @router.post("/companies/{company_id}/statements/{statement_id}/classify")
    def classify_statement(
        company_id: str,
        statement_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        try:
            summary = classifier.import_and_classify_statement(
                store,
                jobs,
                company_id=company_id,
                user_id=user["id"],
                statement_id=statement_id,
            )
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc
        return summary

    @router.get("/companies/{company_id}/classifications")
    def list_classifications(
        company_id: str,
        status: Optional[str] = Query(None),
        limit: int = Query(200, ge=1, le=2000),
        offset: int = Query(0, ge=0),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if status and status not in {"applied", "review", "rejected", "imported"}:
            raise HTTPException(422, "status must be applied, review, rejected or imported")
        rows = store.list_ledger_transactions(company_id, status=status, limit=limit, offset=offset)
        total = len(store.list_ledger_transactions(company_id, status=status))
        return {"transactions": rows, "total": total}

    @router.post("/companies/{company_id}/classifications/{txn_id}/approve")
    def approve_classification(
        company_id: str,
        txn_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        txn = _ledger_txn(store, company_id, txn_id, user["id"])
        updated = store.update_ledger_transaction(
            txn_id, company_id, status="applied", confidence=max(txn.get("confidence") or 0, 0.95)
        )
        if txn.get("account_code"):
            classifier.remember(
                store,
                company_id=company_id,
                description=txn.get("description") or "",
                account_code=txn["account_code"],
                category=txn.get("category"),
                confidence=0.95,
                rationale="approved in review queue",
            )
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="classification.approved",
            entity="ledger_transactions",
            entity_id=txn_id,
            old_value={"status": txn.get("status"), "account_code": txn.get("account_code")},
            new_value={"status": "applied"},
        )
        return updated

    @router.post("/companies/{company_id}/classifications/{txn_id}/reclassify")
    def reclassify_transaction(
        company_id: str,
        txn_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        txn = _ledger_txn(store, company_id, txn_id, user["id"])
        _require(payload, "account_code")
        account_code = str(payload["account_code"]).strip()
        _require_account_code(store, company_id, account_code)
        category = _s(payload.get("category"))
        updated = store.update_ledger_transaction(
            txn_id,
            company_id,
            account_code=account_code,
            category=category,
            confidence=1.0,
            source="manual",
            status="applied",
            rationale=_s(payload.get("reason")) or "reclassified by user",
        )
        classifier.remember(
            store,
            company_id=company_id,
            description=txn.get("description") or "",
            account_code=account_code,
            category=category,
            confidence=1.0,
            rationale=updated.get("rationale") or "reclassified by user",
        )
        if payload.get("save_as_rule"):
            store.create_classification_rule(
                company_id,
                name=f"learned from {txn_id[:8]}",
                match_type="contains",
                match_value=(txn.get("description") or "")[:200],
                account_code=account_code,
            )
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="classification.reclassified",
            entity="ledger_transactions",
            entity_id=txn_id,
            old_value={"account_code": txn.get("account_code"), "status": txn.get("status")},
            new_value={"account_code": account_code, "status": "applied"},
        )
        return updated

    @router.post("/companies/{company_id}/classifications/{txn_id}/reject")
    def reject_classification(
        company_id: str,
        txn_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        txn = _ledger_txn(store, company_id, txn_id, user["id"])
        updated = store.update_ledger_transaction(txn_id, company_id, status="rejected")
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="classification.rejected",
            entity="ledger_transactions",
            entity_id=txn_id,
            old_value={"status": txn.get("status")},
            new_value={"status": "rejected"},
        )
        return updated

    @router.post("/companies/{company_id}/classify/suggest")
    def suggest_classification(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        _require(payload, "description")
        company = store.get_company(company_id, user["id"])
        result = classifier.classify_transaction(
            store,
            company,
            description=str(payload["description"]),
            debit=_as_money(payload.get("debit")),
            credit=_as_money(payload.get("credit")),
        )
        account = store.get_chart_account_by_code(company_id, result.account_code)
        return {
            **result.to_dict(),
            "account_name": account.get("name") if account else None,
            "needs_review": result.confidence < classifier.REVIEW_THRESHOLD,
        }

    # ------------------------------------------------------------------ #
    # Classification rules
    # ------------------------------------------------------------------ #
    @router.get("/companies/{company_id}/classification-rules")
    def list_classification_rules(
        company_id: str, user: dict = Depends(get_current_user)
    ) -> dict:
        _company(store, company_id, user["id"])
        return {"rules": store.list_classification_rules(company_id)}

    @router.post("/companies/{company_id}/classification-rules")
    def create_classification_rule(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        _require(payload, "match_value")
        _require(payload, "account_code")
        match_type = _s(payload.get("match_type")) or "contains"
        if match_type not in {"contains", "exact", "regex"}:
            raise HTTPException(422, "match_type must be contains, exact or regex")
        _require_account_code(store, company_id, str(payload["account_code"]))
        rule = store.create_classification_rule(
            company_id,
            name=_s(payload.get("name")) or f"Rule {len(store.list_classification_rules(company_id)) + 1}",
            match_type=match_type,
            match_value=str(payload["match_value"]).strip(),
            account_code=str(payload["account_code"]).strip(),
            enabled=bool(payload.get("enabled", True)),
        )
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="classification_rule.created",
            entity="classification_rules",
            entity_id=rule["id"],
            new_value=_pick(rule, ("name", "match_type", "match_value", "account_code")),
        )
        return rule

    @router.put("/companies/{company_id}/classification-rules/{rule_id}")
    def update_classification_rule(
        company_id: str,
        rule_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if store.get_classification_rule(rule_id, company_id) is None:
            raise HTTPException(404, "Rule not found.")
        if payload.get("match_type") and payload["match_type"] not in {"contains", "exact", "regex"}:
            raise HTTPException(422, "match_type must be contains, exact or regex")
        if payload.get("account_code"):
            _require_account_code(store, company_id, str(payload["account_code"]))
        fields = {
            k: v
            for k, v in payload.items()
            if k in {"name", "match_type", "match_value", "account_code", "enabled"}
            and v is not None
        }
        updated = store.update_classification_rule(rule_id, company_id, **fields)
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="classification_rule.updated",
            entity="classification_rules",
            entity_id=rule_id,
            old_value=_pick(store.get_classification_rule(rule_id, company_id), fields),
            new_value=_pick(updated, fields),
        )
        return updated

    @router.delete("/companies/{company_id}/classification-rules/{rule_id}")
    def delete_classification_rule(
        company_id: str,
        rule_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if not store.delete_classification_rule(rule_id, company_id):
            raise HTTPException(404, "Rule not found.")
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="classification_rule.deleted",
            entity="classification_rules",
            entity_id=rule_id,
        )
        return {"deleted": rule_id}

    # ------------------------------------------------------------------ #
    # AI memory
    # ------------------------------------------------------------------ #
    @router.get("/companies/{company_id}/ai-memory")
    def list_ai_memory(
        company_id: str,
        limit: int = Query(200, ge=1, le=1000),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        return {"memory": store.list_ai_memory(company_id, limit=limit)}

    @router.delete("/companies/{company_id}/ai-memory/{memory_id}")
    def delete_ai_memory(
        company_id: str,
        memory_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        if not store.delete_ai_memory(memory_id, company_id):
            raise HTTPException(404, "Memory entry not found.")
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="ai_memory.deleted",
            entity="ai_memory",
            entity_id=memory_id,
        )
        return {"deleted": memory_id}

    # ------------------------------------------------------------------ #
    # Posting, journals, trial balance & adjustments
    # ------------------------------------------------------------------ #
    @router.post("/companies/{company_id}/posting/run")
    def run_posting(
        company_id: str,
        payload: dict = Body(default={}),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        try:
            return posting.post_applied_transactions(
                store,
                company_id=company_id,
                user_id=user["id"],
                period_id=_s(payload.get("period_id")) if payload else None,
                statement_id=_s(payload.get("statement_id")) if payload else None,
            )
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    @router.get("/companies/{company_id}/journals")
    def list_journals(
        company_id: str,
        period_id: Optional[str] = Query(None),
        limit: int = Query(100, ge=1, le=2000),
        offset: int = Query(0, ge=0),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        entries = store.list_journal_entries(
            company_id, period_id=period_id, limit=limit, offset=offset
        )
        return {"journals": entries, "total": len(entries)}

    @router.get("/companies/{company_id}/journals/{journal_id}")
    def get_journal(
        company_id: str,
        journal_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        entry = store.get_journal_entry(journal_id, company_id)
        if entry is None:
            raise HTTPException(404, "Journal entry not found.")
        return entry

    @router.post("/companies/{company_id}/journals/{journal_id}/reverse")
    def reverse_journal(
        company_id: str,
        journal_id: str,
        payload: dict = Body(default={}),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        try:
            return posting.unpost_journal(
                store,
                company_id=company_id,
                user_id=user["id"],
                journal_id=journal_id,
                reason=_s(payload.get("reason")) if payload else None,
            )
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc

    @router.get("/companies/{company_id}/trial-balance")
    def get_trial_balance(
        company_id: str,
        period_id: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        return posting.trial_balance(store, company_id=company_id, period_id=period_id)

    @router.post("/companies/{company_id}/adjustments")
    def create_adjustment(
        company_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        _require(payload, "description")
        try:
            return posting.create_adjustment(
                store,
                company_id=company_id,
                user_id=user["id"],
                period_id=_s(payload.get("period_id")),
                adj_type=_s(payload.get("adj_type")) or "manual",
                description=str(payload["description"]),
                amount=_as_money(payload.get("amount")) or 0,
            )
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    @router.get("/companies/{company_id}/adjustments")
    def list_adjustments(
        company_id: str,
        period_id: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        return {"adjustments": store.list_adjustments(company_id, period_id=period_id)}

    @router.delete("/companies/{company_id}/adjustments/{adj_id}")
    def delete_adjustment(
        company_id: str,
        adj_id: str,
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        adjustment = store.get_adjustment(adj_id, company_id)
        if adjustment is None:
            raise HTTPException(404, "Adjustment not found.")
        if adjustment.get("approved_by") or adjustment.get("journal_id"):
            raise HTTPException(400, "Cannot delete an approved adjustment; reverse its journal first.")
        store.delete_adjustment(adj_id, company_id)
        audit_log.log(
            store,
            company_id=company_id,
            user_id=user["id"],
            action="adjustment.deleted",
            entity="adjustments",
            entity_id=adj_id,
        )
        return {"deleted": adj_id}

    @router.post("/companies/{company_id}/adjustments/{adj_id}/approve")
    def approve_adjustment(
        company_id: str,
        adj_id: str,
        payload: dict = Body(...),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        _require(payload, "debit_code")
        _require(payload, "credit_code")
        try:
            return posting.approve_adjustment(
                store,
                company_id=company_id,
                user_id=user["id"],
                adj_id=adj_id,
                debit_code=str(payload["debit_code"]).strip(),
                credit_code=str(payload["credit_code"]).strip(),
                date=_s(payload.get("date")),
            )
        except KeyError as exc:
            raise HTTPException(404, str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(400, str(exc)) from exc

    # ------------------------------------------------------------------ #
    # Financial statement reports
    # ------------------------------------------------------------------ #
    @router.get("/companies/{company_id}/reports/income-statement")
    def get_income_statement(
        company_id: str,
        period_id: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        return statements.income_statement(
            store, company_id=company_id, period_id=period_id
        )

    @router.get("/companies/{company_id}/reports/balance-sheet")
    def get_balance_sheet(
        company_id: str,
        period_id: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        return statements.balance_sheet(
            store, company_id=company_id, period_id=period_id
        )

    @router.get("/companies/{company_id}/reports/cash-flow")
    def get_cash_flow(
        company_id: str,
        period_id: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        return statements.cash_flow_statement(
            store, company_id=company_id, period_id=period_id
        )

    @router.get("/companies/{company_id}/reports/{report_kind}/pdf")
    def download_report_pdf(
        company_id: str,
        report_kind: str,
        period_id: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ) -> Response:
        if report_kind not in report_pdf.REPORT_TITLES:
            raise HTTPException(
                400, f"report_kind must be one of {sorted(report_pdf.REPORT_TITLES)}"
            )
        company = _company(store, company_id, user["id"])
        builders = {
            "income-statement": statements.income_statement,
            "balance-sheet": statements.balance_sheet,
            "cash-flow": statements.cash_flow_statement,
        }
        data = builders[report_kind](store, company_id=company_id, period_id=period_id)
        content = report_pdf.build_report_pdf(
            company=company, report_kind=report_kind, data=data
        )
        slug = f"{company['name']} {report_kind}".replace(" ", "_").lower()
        return Response(
            content=content,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{slug}.pdf"'},
        )

    @router.get("/companies/{company_id}/reports/{report_kind}/xlsx")
    def download_report_xlsx(
        company_id: str,
        report_kind: str,
        period_id: Optional[str] = Query(None),
        user: dict = Depends(get_current_user),
    ) -> Response:
        if report_kind not in report_pdf.REPORT_TITLES:
            raise HTTPException(
                400, f"report_kind must be one of {sorted(report_pdf.REPORT_TITLES)}"
            )
        company = _company(store, company_id, user["id"])
        builders = {
            "income-statement": statements.income_statement,
            "balance-sheet": statements.balance_sheet,
            "cash-flow": statements.cash_flow_statement,
        }
        data = builders[report_kind](store, company_id=company_id, period_id=period_id)
        content = report_xlsx.build_report_xlsx(
            company=company, report_kind=report_kind, data=data
        )
        slug = f"{company['name']} {report_kind}".replace(" ", "_").lower()
        return Response(
            content=content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{slug}.xlsx"'},
        )

    # ------------------------------------------------------------------ #
    # Audit trail
    # ------------------------------------------------------------------ #
    @router.get("/companies/{company_id}/audit-log")
    def get_audit_log(
        company_id: str,
        limit: int = Query(200, ge=1, le=2000),
        user: dict = Depends(get_current_user),
    ) -> dict:
        _company(store, company_id, user["id"])
        return {"entries": store.list_audit_logs(company_id, limit=limit)}

    return router


# ---------------------------------------------------------------------- #
# Helpers
# ---------------------------------------------------------------------- #
def _require(payload: dict, key: str) -> None:
    if not payload or payload.get(key) in (None, ""):
        raise HTTPException(422, f"Field '{key}' is required.")


def _s(value: Optional[str]) -> Optional[str]:
    return str(value).strip() if value is not None else None


def _company(store, company_id: str, user_id: str) -> dict:
    company = store.get_company(company_id, user_id)
    if company is None:
        raise HTTPException(404, "Company not found.")
    return company


def _ledger_txn(store, company_id: str, txn_id: str, user_id: str) -> dict:
    _company(store, company_id, user_id)
    txn = store.get_ledger_transaction(txn_id, company_id)
    if txn is None:
        raise HTTPException(404, "Transaction not found.")
    return txn


def _require_account_code(store, company_id: str, code: str) -> None:
    if store.get_chart_account_by_code(company_id, code) is None:
        raise HTTPException(422, f"account_code '{code}' is not in this company's chart of accounts.")


def _as_money(value) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        raise HTTPException(422, "Amounts must be numeric.") from None


def _ensure_coa(store, company: dict, user_id: str) -> None:
    if store.list_chart_of_accounts(company["id"]):
        return
    accounts = coa.generate_default_coa(company.get("industry"))
    store.replace_chart_of_accounts(company["id"], accounts)
    audit_log.log(
        store,
        company_id=company["id"],
        user_id=user_id,
        action="coa.generated",
        entity="chart_of_accounts",
        entity_id=company["id"],
        new_value={"count": len(accounts), "industry": company.get("industry")},
    )


def _pick(source: dict, keys) -> dict:
    if isinstance(keys, dict):
        keys = tuple(keys.keys())
    wanted = keys if isinstance(keys, (tuple, list)) else (keys,)
    return {k: source.get(k) for k in wanted if k in source}
