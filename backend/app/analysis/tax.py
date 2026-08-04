"""Rule-based tax assistant: estimate business spend, a conservative
tax-deductible figure and embedded VAT from transaction categories.

Explicitly an *estimate* for review, not tax advice. Category keyword rules
mirror the categorizer so labels stay consistent.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from app.core.models import SummaryStats, Transaction

# Categories treated as business/revenue-generating spend. ATM cash, loan,
# investment and tax payments themselves are excluded.
BUSINESS_CATEGORIES = {"POS", "Transfer", "Bills", "Charges"}

# Categories that most plausibly include VAT (goods & services purchases).
VAT_CATEGORIES = {"POS", "Bills"}

# Nigerian VAT is 7.5%. For a VAT-inclusive price P the VAT = P * 0.075 / 1.075.
VAT_RATE = 0.075
_EMBEDDED = VAT_RATE / (1 + VAT_RATE)


@dataclass
class TaxSummary:
    business_expenses: float = 0.0
    deductible_estimate: float = 0.0
    vat_estimate: float = 0.0
    business_category_breakdown: dict[str, float] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "business_expenses": round(self.business_expenses, 2),
            "deductible_estimate": round(self.deductible_estimate, 2),
            "vat_estimate": round(self.vat_estimate, 2),
            "business_category_breakdown": self.business_category_breakdown,
            "notes": self.notes,
        }


def _fmt(value: float) -> str:
    return f"{value:,.2f}"


def estimate_tax(
    transactions: list[Transaction],
    summary: Optional[SummaryStats] = None,  # noqa: ARG001 (reserved)
) -> TaxSummary:
    result = TaxSummary()
    by_category: dict[str, float] = {}
    vat_base = 0.0

    for t in transactions:
        if t.is_beginning_balance or t.is_ending_balance or t.debit is None:
            continue
        category = (t.category or "Other").strip()
        if category in BUSINESS_CATEGORIES:
            by_category[category] = by_category.get(category, 0.0) + t.debit
        if category in VAT_CATEGORIES:
            vat_base += t.debit

    if not by_category and vat_base <= 0:
        return result

    business_total = sum(by_category.values())
    # Conservative deductibility: all POS/Bills/Charges but only half of
    # transfers (vendor vs personal transfers are indistinguishable here).
    conservative = (
        by_category.get("POS", 0.0)
        + by_category.get("Bills", 0.0)
        + by_category.get("Charges", 0.0)
        + by_category.get("Transfer", 0.0) * 0.5
    )

    result.business_expenses = round(business_total, 2)
    result.deductible_estimate = round(conservative, 2)
    result.vat_estimate = round(vat_base * _EMBEDDED, 2)
    result.business_category_breakdown = {k: round(v, 2) for k, v in sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)}
    result.notes = [
        f"Business-related spending (POS, transfers, bills, charges) totals {_fmt(business_total)}.",
        f"Conservative tax-deductible estimate is {_fmt(conservative)} — 50% of transfers assumed business.",
        f"Estimated VAT embedded in purchases (POS + bills at {VAT_RATE * 100:.1f}%) is {_fmt(result.vat_estimate)}.",
        "These are automated estimates for review only, not tax advice. Confirm with your accountant.",
    ]
    return result
