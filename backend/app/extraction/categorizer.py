"""Rule-based transaction categorisation.

PRD future enhancement #1: automatically label every transaction with a
category (Salary, Transfer, POS, ATM, Charges, Interest, Bills, Loan,
Investment, Tax, Other) so accountants can slice the workbook by category.

The engine is description-keyword driven and order matters: more specific
categories are checked before generic ones so that e.g. "SALARY PAYMENT VIA
NIP" becomes Salary, not Transfer.
"""

from __future__ import annotations

from typing import Optional

CATEGORY_RULES: list[tuple[str, list[str]]] = [
    (
        "Salary",
        [
            "salary",
            "remuneration",
            "wages",
            "payroll",
            "monthly pay",
            "salary payment",
        ],
    ),
    (
        "Investment",
        [
            "investment",
            "fixed deposit",
            "treasury",
            "mutual fund",
            "unit trust",
            "money market",
        ],
    ),
    (
        "Loan",
        ["loan", "mortgage", "overdraft", "credit facility", "lending"],
    ),
    (
        "Tax",
        ["tax", "firs", "withholding", "stamp duty"],
    ),
    (
        "Interest",
        ["interest", "credit interest", "eod interest"],
    ),
    (
        "ATM",
        ["atm ", "atm/", "cash withdrawal", "withdrawal", "cashpoint", "cash machine"],
    ),
    (
        "POS",
        ["pos ", "pos/", "point of sale", "purchase", "shoprite", "swipe", "terminal"],
    ),
    (
        "Charges",
        [
            "charge",
            "commission",
            "vat",
            "fees",
            "bank charges",
            "service charge",
            "ledger fee",
            "maintenance fee",
        ],
    ),
    (
        "Bills",
        [
            "dstv",
            "gotv",
            "showmax",
            "ekedc",
            "phedc",
            "ieee",
            "utility",
            "electricity",
            "water",
            "internet",
            "airtime",
            "data",
            "cable tv",
            "subscription",
            "bill payment",
        ],
    ),
    (
        "Transfer",
        [
            "transfer",
            "trf/",
            "trf ",
            "nip",
            "intrabank",
            "interbank",
            "inward",
            "outward",
            "received from",
            "paid to",
            "bank transfer",
            "neft",
            "rtgs",
        ],
    ),
]

DEFAULT_CATEGORY = "Other"

# Keywords that turn a would-be Transfer into a refund/reversal type.
_REFUND_MARKERS = ("refund", "reversal", "reversed", "chargeback", "reversal")


def categorize(description: Optional[str]) -> str:
    """Return a category label for a transaction description."""
    if not description:
        return DEFAULT_CATEGORY
    low = " ".join(description.lower().split())
    if not low:
        return DEFAULT_CATEGORY
    if any(m in low for m in _REFUND_MARKERS):
        return "Refund"
    for category, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw in low:
                return category
    return DEFAULT_CATEGORY
