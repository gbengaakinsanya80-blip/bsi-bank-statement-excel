"""Rule-based transaction categorisation into accounting-style account heads.

PRD future enhancement #1: automatically label every transaction with an
account head (Salary, Interest, POS, Bills, Rent, Utilities, etc.) so
accountants can slice the workbook by chart-of-accounts heads.

The engine is description-keyword driven and order matters: more specific
categories are checked before generic ones so that e.g. "SALARY PAYMENT VIA
NIP" becomes Salary, not Transfer, and "POS PURCHASE SHOPRITE" stays POS
rather than falling through to Food & Groceries.
"""

from __future__ import annotations

import re
from typing import Optional

# Account-head taxonomy. Names deliberately read like a chart of accounts.
# Order is significant: specific heads first, generic fallbacks (Charges,
# Tax, Transfer) last.
CATEGORY_RULES: list[tuple[str, list[str]]] = [
    (
        "Salary",
        [
            "salary", "wages", "payroll", "remuneration", "monthly pay",
            "net pay", "emolument", "staff salary", "salary payment",
            "salary credit", "salary paid", "compensation",
        ],
    ),
    (
        "Interest",
        [
            "interest", "credit interest", "eod interest", "interest earned",
            "interest paid", "interest accrued",
        ],
    ),
    (
        "Investment",
        [
            "investment", "fixed deposit", "treasury", "mutual fund",
            "unit trust", "money market", "dividend", "bond", "stock broking",
            "capital market", "share purchase",
        ],
    ),
    (
        "Loan Repayment",
        [
            "loan repayment", "loan payment", "loan remittance", "repayment",
            "instalment", "installment", "loan recovery", "loan debit",
            "monthly repayment",
        ],
    ),
    (
        "Loan",
        [
            "loan", "mortgage", "overdraft", "credit facility", "lending",
            "loan advance", "loan disbursement", "loan proceeds",
            "personal loan",
        ],
    ),
    (
        "ATM",
        [
            "atm", "cash withdrawal", "withdrawal", "cashpoint", "cash machine",
            "atm withdrawal", "cash dispense", "cash out",
        ],
    ),
    (
        "POS",
        [
            "pos", "point of sale", "swipe", "terminal",
            "debit card", "card payment", "card purchase", "card transaction",
        ],
    ),
    (
        "Cash",
        [
            "cash deposit", "cash lodgement", "cash paid", "cash received",
            "over the counter", "teller", "lodgement", "cash deposit machine",
        ],
    ),
    (
        "Food & Groceries",
        [
            "shoprite", "spar", "justrite", "supermarket", "grocery",
            "groceries", "food", "market", "restaurant", "eatery", "cafe",
            "canteen", "burger", "pizza", "kfc", "mcdonald", "dominos",
            "chicken", "suya", "bakery", "smoothie", "provisions",
            "food store", "foodstuff",
        ],
    ),
    (
        "Transport & Fuel",
        [
            "transport", "taxi", "uber", "bolt", "bus", "train", "flight",
            "airline", "airport", "fuel", "petrol", "diesel", "gas", "toll",
            "car hire", "cab", "fare",
        ],
    ),
    (
        "Entertainment",
        [
            "cinema", "filmhouse", "netflix", "spotify", "entertainment",
            "betting", "sportybet", "bet9ja", "nairabet", "bet", "concert",
            "theatre", "playstation", "xbox", "video game",
        ],
    ),
    (
        "Health & Medical",
        [
            "hospital", "clinic", "pharmacy", "medical", "health", "doctor",
            "dentist", "drug", "drugs", "medication", "pharma", "laboratory",
            "lab", "optician", "eye care", "consultation",
        ],
    ),
    (
        "Education",
        [
            "school", "tuition", "university", "college", "textbook",
            "text books", "exam", "waec", "jamb", "neco", "lesson",
            "institute", "polytechnic", "education", "course fee",
        ],
    ),
    (
        "Rent & Accommodation",
        [
            "rent", "accommodation", "hostel", "apartment", "tenancy",
            "lease", "rental", "house rent", "office rent", "store rent",
        ],
    ),
    (
        "Insurance",
        [
            "insurance", "insurer", "annuity", "premium", "nhis",
            "life policy", "health insurance", "motor insurance", "risk cover",
        ],
    ),
    (
        "Shopping & Retail",
        [
            "shopping", "mall", "fashion", "clothing", "boutique",
            "footwear", "jewellery", "jewelry", "electronics", "gadget",
            "online store", "amazon", "jumia", "konga", "aliexpress", "ebay",
            "cosmetics", "department store", "spare parts", "hardware",
            "phone accessories", "big sale",
        ],
    ),
    (
        "Business Expense",
        [
            "business", "stationery", "printing", "courier", "logistics",
            "marketing", "advertising", "consultancy", "professional fee",
            "legal", "software", "saas", "workshop", "office", "office supplies",
            "wholesale", "supplier", "supplies", "procurement", "dealer",
            "contractor", "outsourcing", "recruitment", "website", "hosting",
        ],
    ),
    (
        "Customer Receipts",
        [
            "sales", "invoice", "customer", "received from", "payment received",
            "paid by", "goods", "revenue", "advance payment", "deposit received",
            "payout", "proceeds", "collection", "payment from",
        ],
    ),
    (
        "Government & Authorities",
        [
            "government", "cac", "lasg", "frsc", "ministry", "court", "fine",
            "penalty", "custom", "customs", "immigration", "duty", "licence",
            "license", "permit", "levy", "police", "municipal",
        ],
    ),
    (
        "Donation & Charity",
        [
            "donation", "tithe", "offering", "charity", "church", "mosque",
            "zakat", "ngo", "non profit", "non-profit", "mission",
            "benevolence",
        ],
    ),
    (
        "Bills",
        [
            "dstv", "gotv", "showmax", "ekedc", "phedc", "ibedc", "aedc",
            "ieee", "electricity", "utility", "water", "internet", "airtime",
            "data", "cable", "subscription", "bill payment", "bill pay",
            "recharge", "prepaid", "postpaid", "telephone",
        ],
    ),
    (
        "Charges",
        [
            "charge", "charges", "commission", "vat", "fees", "bank charges",
            "service charge", "ledger fee", "maintenance fee", "card fee",
            "sms", "cheque book", "cheque leaf", "deduction",
        ],
    ),
    (
        "Tax",
        [
            "tax", "firs", "withholding", "stamp duty", "paye",
            "withholding tax",
        ],
    ),
    (
        "Transfer",
        [
            "transfer", "trf", "nip", "intrabank", "interbank", "inward",
            "outward", "paid to", "bank transfer", "neft", "rtgs",
            "remittance", "clearing", "settlement", "mobile transfer",
            "instant transfer", "account to account", "fund transfer",
        ],
    ),
]

DEFAULT_CATEGORY = "Other"

# Keywords that turn a would-be Transfer into a refund/reversal type.
_REFUND_MARKERS = ("refund", "reversal", "reversed", "chargeback", "rebate", "returned")


def _build_pattern(keyword: str) -> re.Pattern:
    """Compile a keyword matcher.

    Plain alphanumeric keywords use word boundaries so short keys like ``pos``
    or ``atm`` do not hit inside unrelated words (``POSITION``, ``ATMOSPHERE``).
    Keywords containing punctuation (``trf/`` style) fall back to substring
    matching.
    """
    if keyword.isalnum():
        return re.compile(rf"\b{re.escape(keyword)}\b")
    return re.compile(re.escape(keyword))


_PATTERNS: list[tuple[str, list[re.Pattern]]] = [
    (category, [_build_pattern(kw) for kw in keywords])
    for category, keywords in CATEGORY_RULES
]


def categorize(description: Optional[str]) -> str:
    """Return an account-head category label for a transaction description."""
    if not description:
        return DEFAULT_CATEGORY
    low = " ".join(description.lower().split())
    if not low:
        return DEFAULT_CATEGORY
    if any(m in low for m in _REFUND_MARKERS):
        return "Refund"
    for category, patterns in _PATTERNS:
        for pattern in patterns:
            if pattern.search(low):
                return category
    return DEFAULT_CATEGORY
