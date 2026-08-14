"""Transaction classification engine (PRD: AI learning engine).

Deterministic-first, LLM-assisted. Every transaction is classified into a
chart-of-accounts account code through a provider chain:

    user rules  ->  ai_memory  ->  rule-based categorizer  ->  LLM (optional)

Only descriptions the deterministic stack scores below the review threshold
are sent to the LLM, and only when ``OPENAI_API_KEY`` is set and the ``openai``
package is installed. Every classification records its source and confidence;
low-confidence rows land in the review queue for the accountant to approve or
reclassify, and reclassifications teach ``ai_memory`` so the next statement
imports faster and more accurately.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from typing import Any, Optional

from app.extraction import categorizer

REVIEW_THRESHOLD = 0.85

# Contra-equity account credited when the opening bank balance is brought into
# the books (DR Bank 1010 / CR this account).
OPENING_EQUITY_CODE = "3020"

# (category, debit_account_code, credit_account_code). ``None`` means that
# direction has no sensible default for the category.
CATEGORY_MAP: dict[str, tuple[Optional[str], Optional[str]]] = {
    "Salary": ("6010", None),
    "Interest": ("6070", "4050"),
    "Investment": ("1200", "4050"),
    "Loan Repayment": ("2060", None),
    "Loan": (None, "2060"),
    "ATM": ("1020", None),
    "POS": ("5010", None),
    "Cash": (None, "1020"),
    "Food & Groceries": ("5010", None),
    "Transport & Fuel": ("6130", "6130"),
    "Entertainment": ("6140", None),
    "Health & Medical": ("6140", None),
    "Education": ("6140", None),
    "Rent & Accommodation": ("6020", None),
    "Insurance": ("6100", None),
    "Shopping & Retail": ("5010", None),
    "Business Expense": ("6140", None),
    "Customer Receipts": (None, "4010"),
    "Government & Authorities": ("6140", None),
    "Donation & Charity": ("6140", None),
    "Bills": ("6060", None),
    "Charges": ("6070", None),
    "Tax": ("2030", None),
    "Transfer": ("1200", "1200"),
    "Refund": ("6140", "4050"),
    "Other": ("1200", "1200"),
}

# Sub-keyword refinements applied inside a category (checked in order).
_CATEGORY_REFINEMENTS: dict[str, list[tuple[str, str]]] = {
    "Bills": [
        ("electricity", "6030"), ("ekedc", "6030"), ("phedc", "6030"), ("ibedc", "6030"), ("aedc", "6030"),
        ("water", "6040"),
        ("internet", "6050"),
        ("airtime", "6060"), ("data", "6060"), ("dstv", "6060"), ("gotv", "6060"), ("cable", "6060"),
    ],
    "Transport & Fuel": [
        ("fuel", "6080"), ("petrol", "6080"), ("diesel", "6080"), ("gas", "6080"),
        ("taxi", "6130"), ("uber", "6130"), ("flight", "6130"), ("airline", "6130"), ("bus", "6130"),
    ],
}

# Baseline confidence for a word-boundary keyword hit, per category. Most
# categories are distinctive enough to auto-apply; genuinely ambiguous ones
# (internal transfers, uncategorised noise) stay in the review queue.
_CATEGORY_CONFIDENCE: dict[str, float] = {
    "Salary": 0.92,
    "Interest": 0.9,
    "Investment": 0.8,
    "Loan": 0.88,
    "Loan Repayment": 0.88,
    "ATM": 0.85,
    "POS": 0.85,
    "Cash": 0.8,
    "Food & Groceries": 0.88,
    "Transport & Fuel": 0.88,
    "Entertainment": 0.85,
    "Health & Medical": 0.9,
    "Education": 0.9,
    "Rent & Accommodation": 0.9,
    "Insurance": 0.9,
    "Shopping & Retail": 0.85,
    "Business Expense": 0.88,
    "Customer Receipts": 0.9,
    "Government & Authorities": 0.85,
    "Donation & Charity": 0.85,
    "Bills": 0.9,
    "Charges": 0.85,
    "Tax": 0.9,
    "Refund": 0.8,
    "Transfer": 0.35,
    "Other": 0.25,
}

# Reverse map: account_code -> best category label (for rule-driven hits).
_CODE_TO_CATEGORY: dict[str, str] = {
    code: category
    for category, (debit, credit) in CATEGORY_MAP.items()
    for code in (debit, credit)
    if code
}

_SENTINEL = object()
_LLM: Any = _SENTINEL


@dataclass
class Classification:
    category: str
    account_code: str
    confidence: float
    source: str  # rule | memory | categorizer | llm | manual
    rationale: str = ""

    def to_dict(self) -> dict:
        return {
            "category": self.category,
            "account_code": self.account_code,
            "confidence": round(self.confidence, 3),
            "source": self.source,
            "rationale": self.rationale,
        }


def normalize_description(description: Optional[str]) -> str:
    """Fingerprint used for ai_memory lookups and exact rule matching."""
    if not description:
        return ""
    text = " ".join(description.lower().split())
    text = re.sub(r"\b(?:n[0-9]{6,}|[0-9]{8,}|ref[:\s]*[a-z0-9]+)\b", "", text)
    return " ".join(text.split())


def _match_category(description: str) -> tuple[str, Optional[str]]:
    """Return (category, matched_keyword_or_None) for a description."""
    low = " ".join(description.lower().split())
    if not low:
        return "Other", None
    if any(m in low for m in categorizer._REFUND_MARKERS):  # noqa: SLF001
        return "Refund", None
    for category, patterns in categorizer._PATTERNS:  # noqa: SLF001
        for pattern in patterns:
            if pattern.search(low):
                return category, pattern.pattern.strip("\\b")
    return "Other", None


def _keyword_confidence(category: str, keyword: Optional[str]) -> float:
    return _CATEGORY_CONFIDENCE.get(category, 0.8)


def _refine_code(category: str, description: str) -> Optional[str]:
    low = " ".join(description.lower().split())
    for keyword, code in _CATEGORY_REFINEMENTS.get(category, ()):
        if keyword in low:
            return code
    return None


def classify_transaction(
    store,
    company: dict,
    *,
    description: str = "",
    debit: Optional[float] = None,
    credit: Optional[float] = None,
) -> Classification:
    """Classify a single description into an account code (deterministic-first)."""
    fp = normalize_description(description)
    coa_codes = _coa_codes(store, company["id"])
    direction = "credit" if (credit or 0) > 0 else "debit"

    # 1. User-defined rules (company specific, highest priority).
    for rule in store.list_classification_rules(company["id"]):
        if not rule.get("enabled", 1):
            continue
        if _rule_matches(rule, description):
            return Classification(
                category=_CODE_TO_CATEGORY.get(rule["account_code"], "Other"),
                account_code=rule["account_code"],
                confidence=0.95,
                source="rule",
                rationale=f"rule {rule.get('name') or rule['id']} matched {rule['match_value']}",
            )

    # 2. Learned ai_memory (exact fingerprint from a past approval).
    if fp:
        memory = store.get_ai_memory(company["id"], fp)
        if memory and memory.get("account_code"):
            return Classification(
                category=memory.get("category") or "Other",
                account_code=memory["account_code"],
                confidence=0.95,
                source="memory",
                rationale=memory.get("rationale") or "learned from a previous approval",
            )

    # 3. Rule-based categorizer.
    category, keyword = _match_category(description)
    debit_code, credit_code = CATEGORY_MAP.get(category, ("1200", "1200"))
    if direction == "debit":
        default_code = debit_code or credit_code or "1200"
    else:
        default_code = credit_code or debit_code or "1200"
    code = _refine_code(category, description) or default_code
    confidence = _keyword_confidence(category, keyword)
    if code not in coa_codes and code is not None:
        confidence = min(confidence, 0.5)
    classification = Classification(
        category=category,
        account_code=code or "1200",
        confidence=confidence,
        source="categorizer",
        rationale=f"{category} via keyword rules",
    )

    # 4. LLM only for low-confidence rows, only when configured.
    if classification.confidence < REVIEW_THRESHOLD:
        llm = _llm_provider()
        if llm is not None:
            suggestion = llm.suggest(
                account_codes=coa_codes,
                description=description,
                debit=debit,
                credit=credit,
            )
            if suggestion and suggestion.get("account_code") in coa_codes:
                llm_conf = float(suggestion.get("confidence") or 0.9)
                return Classification(
                    category=_CODE_TO_CATEGORY.get(suggestion["account_code"], category),
                    account_code=suggestion["account_code"],
                    confidence=min(0.98, llm_conf),
                    source="llm",
                    rationale=suggestion.get("rationale") or "LLM suggestion",
                )

    return classification


def _rule_matches(rule: dict, description: str) -> bool:
    match_type = rule.get("match_type") or "contains"
    value = rule.get("match_value") or ""
    low = " ".join(description.lower().split())
    if match_type == "exact":
        return normalize_description(description) == normalize_description(value)
    if match_type == "regex":
        try:
            return re.search(value, low, re.IGNORECASE) is not None
        except re.error:
            return False
    return value.lower() in low


def _coa_codes(store, company_id: str) -> set[str]:
    return {str(a.get("code")) for a in store.list_chart_of_accounts(company_id)}


def import_and_classify_statement(
    store,
    jobs,
    *,
    company_id: str,
    user_id: str,
    statement_id: str,
) -> dict:
    """Pull a linked statement's transactions into the ledger and classify them.

    Idempotent: re-running replaces the statement's previous ledger rows.
    """
    statement = store.get_company_statement(statement_id, company_id)
    if statement is None:
        raise KeyError("Statement not found.")
    company = store.get_company(company_id, user_id)
    if company is None:
        raise KeyError("Company not found.")

    result = jobs.get_result(statement.get("job_id"), user_id=user_id)
    if result is None:
        raise ValueError("Statement has no extractable result.")

    rows: list[dict[str, Any]] = []
    counts = {"imported": 0, "auto": 0, "review": 0}
    for index, txn in enumerate(result.get("transactions", [])):
        if txn.get("is_ending_balance"):
            # The closing balance is the running total; it never posts.
            continue
        if txn.get("is_beginning_balance"):
            # Book the opening bank balance so the Bank account starts from the
            # true cash position: DR Bank / CR Retained Earnings.
            opening = txn.get("balance") or txn.get("debit") or txn.get("credit")
            if opening:
                rows.append(
                    {
                        "row_index": index,
                        "tx_date": _iso_date(txn.get("date")),
                        "description": "Opening Balance",
                        "reference": "",
                        "debit": opening,
                        "credit": None,
                        "balance": opening,
                        "category": "Opening Balance",
                        "account_code": OPENING_EQUITY_CODE,
                        "transaction_type": "opening_balance",
                        "confidence": 1.0,
                        "rationale": "Opening balance carried into the books from the statement.",
                        "status": "applied",
                        "source": "opening_balance",
                        "source_page": txn.get("page_number"),
                        "original_json": json.dumps(txn, default=str),
                    }
                )
                counts["imported"] += 1
                counts["auto"] += 1
            continue
        classification = classify_transaction(
            store,
            company,
            description=txn.get("description") or "",
            debit=txn.get("debit"),
            credit=txn.get("credit"),
        )
        needs_review = classification.confidence < REVIEW_THRESHOLD
        rows.append(
            {
                "row_index": index,
                "tx_date": _iso_date(txn.get("date")),
                "description": txn.get("description") or "",
                "reference": txn.get("reference") or "",
                "debit": txn.get("debit"),
                "credit": txn.get("credit"),
                "balance": txn.get("balance"),
                "category": classification.category,
                "account_code": classification.account_code,
                "transaction_type": txn.get("transaction_type"),
                "confidence": classification.confidence,
                "rationale": classification.rationale,
                "status": "review" if needs_review else "applied",
                "source": classification.source,
                "source_page": txn.get("page_number"),
                "original_json": json.dumps(txn, default=str),
            }
        )
        counts["imported"] += 1
        counts["review" if needs_review else "auto"] += 1

    store.delete_statement_ledger_transactions(statement_id, company_id)
    store.import_ledger_transactions(
        company_id=company_id,
        statement_id=statement_id,
        job_id=statement.get("job_id"),
        rows=rows,
    )
    from app.accounting import audit

    audit.log(
        store,
        company_id=company_id,
        user_id=user_id,
        action="statement.classified",
        entity="ledger_transactions",
        entity_id=statement_id,
        new_value={
            "statement_id": statement_id,
            "imported": counts["imported"],
            "auto_applied": counts["auto"],
            "needs_review": counts["review"],
        },
    )
    return {"statement_id": statement_id, **counts}


def remember(
    store,
    *,
    company_id: str,
    description: str,
    account_code: str,
    category: Optional[str] = None,
    confidence: float = 0.95,
    rationale: str = "user correction",
) -> None:
    """Teach ai_memory from an approved/reclassified transaction."""
    fp = normalize_description(description)
    if not fp:
        return
    store.upsert_ai_memory(
        company_id,
        fingerprint=fp,
        category=category or _CODE_TO_CATEGORY.get(account_code, "Other"),
        account_code=account_code,
        confidence=confidence,
        rationale=rationale,
    )


def _iso_date(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


# ---------------------------------------------------------------------- #
# LLM provider (optional, deterministic-first guard rails)
# ---------------------------------------------------------------------- #
class _OpenAIClassifier:
    def __init__(self, client: Any) -> None:
        self._client = client

    def suggest(
        self,
        *,
        account_codes: set[str],
        description: str,
        debit: Optional[float],
        credit: Optional[float],
    ) -> Optional[dict]:
        codes = ", ".join(sorted(account_codes)) if account_codes else "1200"
        prompt = (
            "You are a meticulous accountant classifying a bank-statement transaction "
            "into a chart of accounts.\n"
            "Reply with JSON only: {\"account_code\": string, \"confidence\": number 0..1, \"rationale\": string}.\n"
            f"Valid account codes: {codes}\n"
            f"Transaction: description={description!r} debit={debit!r} credit={credit!r}"
        )
        try:
            resp = self._client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": "You are an expert accounting classifier."},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0,
                max_tokens=120,
            )
            text = (resp.choices[0].message.content or "").strip()
            data = json.loads(text)
            if isinstance(data, dict) and isinstance(data.get("account_code"), str):
                return data
        except Exception:  # noqa: BLE001 - provider failure degrades to deterministic path
            return None
        return None


def _llm_provider():
    global _LLM
    if _LLM is not _SENTINEL:
        return _LLM
    _LLM = None
    try:
        if not os.environ.get("OPENAI_API_KEY"):
            return None
        import openai

        _LLM = _OpenAIClassifier(openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"], timeout=20))
    except Exception:  # noqa: BLE001
        _LLM = None
    return _LLM
