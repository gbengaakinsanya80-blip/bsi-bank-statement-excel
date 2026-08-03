"""Bank template registry.

The architecture lets new bank templates be added without touching the core
application: each bank entry declares header keywords, balance keywords,
column order hints and known quirks. The layout detector uses these hints but
never relies on them exclusively — it always inspects the actual page.

The registry supports every Nigerian bank plus a generic international layout
and a fallback "auto" profile.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class BankTemplate:
    name: str
    keywords: list[str] = field(default_factory=list)
    beginning_balance_keywords: list[str] = field(default_factory=list)
    ending_balance_keywords: list[str] = field(default_factory=list)
    date_formats: list[str] = field(default_factory=list)
    debit_keywords: list[str] = field(default_factory=list)
    credit_keywords: list[str] = field(default_factory=list)
    balance_keywords: list[str] = field(default_factory=list)
    reference_keywords: list[str] = field(default_factory=list)
    column_order: list[str] = field(default_factory=list)
    multi_column: bool = False
    notes: str = ""


_BEGIN_BAL = [
    "beginning balance", "opening balance", "balance b/f", "b/f",
    "balance brought forward", "brought forward", "opening ledger balance",
    "balance brought fwd", "b/fwd", "opening balance (ngn)",
    "start balance", "opening bal",
]
_END_BAL = [
    "ending balance", "closing balance", "balance c/f", "c/f",
    "closing ledger balance", "balance carried forward", "closing bal",
    "c/fwd", "ending ledger balance", "total",
]

_DEFAULT_DATES = ["%d/%m/%Y", "%d/%m/%y", "%m/%d/%Y", "%m/%d/%y", "%Y-%m-%d", "%d-%m-%Y", "%d %b %Y", "%b %d, %Y", "%Y/%m/%d"]

_COMMON_DEBIT = ["debit", "withdrawal", "debit amount", "amount", "withdrawals", "pay out", "dr"]
_COMMON_CREDIT = ["credit", "deposit", "credit amount", "deposits", "pay in", "cr"]
_COMMON_BAL = ["balance", "balance (ngn)", "bal"]
_COMMON_REF = ["reference", "ref", "ref no", "narration", "txn ref", "remarks", "details", "remarks/narration", "reference no"]

_ORDER = [
    "date", "value_date", "description", "reference", "debit", "credit", "balance",
]

_SUMMARY_BALANCE_BANK = ["summary of account", "closing balance", "total debits", "total credits"]


def _template(
    name: str,
    keywords: list[str],
    *,
    begin: Optional[list[str]] = None,
    end: Optional[list[str]] = None,
    dates: Optional[list[str]] = None,
    debit: Optional[list[str]] = None,
    credit: Optional[list[str]] = None,
    balance: Optional[list[str]] = None,
    reference: Optional[list[str]] = None,
    column_order: Optional[list[str]] = None,
    multi_column: bool = False,
    notes: str = "",
) -> BankTemplate:
    return BankTemplate(
        name=name,
        keywords=keywords,
        beginning_balance_keywords=begin or _BEGIN_BAL,
        ending_balance_keywords=end or _END_BAL,
        date_formats=dates or _DEFAULT_DATES,
        debit_keywords=debit or _COMMON_DEBIT,
        credit_keywords=credit or _COMMON_CREDIT,
        balance_keywords=balance or _COMMON_BAL,
        reference_keywords=reference or _COMMON_REF,
        column_order=column_order or _ORDER,
        multi_column=multi_column,
        notes=notes,
    )


TEMPLATES: dict[str, BankTemplate] = {
    "firstbank": _template(
        "First Bank",
        ["first bank", "firstbank", "first bank of nigeria", "first bank nigeria"],
        begin=["opening balance", "balance b/f", "b/f"],
        end=["closing balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "debit", "credit", "balance"],
        notes="First Bank statements often have 6+ columns with a narration column.",
    ),
    "access": _template(
        "Access Bank",
        ["access bank", "accessbank", "access bank plc", "access diamond"],
        begin=["opening balance", "balance b/f", "opening bal"],
        end=["closing balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "reference", "debit", "credit", "balance"],
    ),
    "zenith": _template(
        "Zenith Bank",
        ["zenith bank", "zenith", "zenith international bank"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "debit", "credit", "balance"],
        notes="Zenith sometimes repeats a summary of account at the end.",
    ),
    "gtbank": _template(
        "GTBank",
        ["gtbank", "gt bank", "guaranty trust bank", "gtco"],
        begin=["opening balance", "balance b/f", "opening bal"],
        end=["closing balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "debit", "credit", "balance"],
    ),
    "uba": _template(
        "UBA",
        ["uba", "united bank for africa"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "reference", "debit", "credit", "balance"],
    ),
    "fidelity": _template(
        "Fidelity Bank",
        ["fidelity bank", "fidelity"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "debit", "credit", "balance"],
    ),
    "fcmb": _template(
        "FCMB",
        ["fcmb", "first city monument bank"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "reference", "debit", "credit", "balance"],
    ),
    "stanbic": _template(
        "Stanbic IBTC",
        ["stanbic", "stanbic ibtc", "ibtc"],
        begin=["opening balance", "opening ledger balance", "balance b/f"],
        end=["closing balance", "closing ledger balance", "balance c/f", "total"],
        column_order=["date", "value_date", "description", "reference", "debit", "credit", "balance"],
        notes="Stanbic often uses 'opening ledger balance'.",
    ),
    "sterling": _template(
        "Sterling Bank",
        ["sterling bank", "sterling"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
    ),
    "union": _template(
        "Union Bank",
        ["union bank", "union bank of nigeria"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
    ),
    "wema": _template(
        "Wema Bank",
        ["wema bank", "wema", "alaj"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
    ),
    "keystone": _template(
        "Keystone Bank",
        ["keystone bank", "keystone"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
    ),
    "ecobank": _template(
        "Ecobank",
        ["ecobank", "eco bank"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
    ),
    "polaris": _template(
        "Polaris Bank",
        ["polaris bank", "polaris"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
    ),
    "providus": _template(
        "Providus Bank",
        ["providus bank", "providus"],
        begin=["opening balance", "balance b/f"],
        end=["closing balance", "balance c/f", "total"],
    ),
    "moniepoint": _template(
        "Moniepoint",
        ["moniepoint", "monie point", "moniepoint mfb", "mfb"],
        begin=["opening balance", "beginning balance", "opening bal"],
        end=["closing balance", "ending balance", "total"],
    ),
    "kuda": _template(
        "Kuda Bank",
        ["kuda bank", "kuda", "kudabank"],
        begin=["opening balance", "beginning balance"],
        end=["closing balance", "ending balance", "total"],
        notes="Kuda is a mobile bank; statements are usually export-style.",
    ),
    "opay": _template(
        "OPay",
        ["opay", "o pay", "opay digital"],
        begin=["opening balance", "beginning balance"],
        end=["closing balance", "ending balance", "total"],
    ),
    "international": _template(
        "International Bank",
        ["bank statement", "account statement", "transaction history", "statement of account"],
        begin=["opening balance", "beginning balance", "balance brought forward", "opening balance brought forward"],
        end=["ending balance", "closing balance", "balance carried forward", "closing balance carried forward"],
        dates=["%m/%d/%Y", "%m/%d/%y", "%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%b %d, %Y", "%d %b %Y"],
        column_order=["date", "description", "reference", "debit", "credit", "balance"],
        notes="Generic profile for non-Nigerian banks.",
    ),
    "generic": _template(
        "Generic Bank",
        [],
        notes="Fully auto-detected layout; no bank-specific assumptions.",
    ),
}

SUPPORTED_BANKS = list(TEMPLATES.keys())


def match_bank(text: str, page_text: str = "") -> tuple[str, float]:
    """Return the best-matching bank template name and a confidence score.

    Scans the first ~3000 characters of the document (bank names usually
    appear in the header). If nothing matches, falls back to 'generic'.
    """
    best_name = "generic"
    best_score = 0.0
    haystack = (text + "\n" + page_text)[:8000].lower()
    for name, tpl in TEMPLATES.items():
        score = 0.0
        for kw in tpl.keywords:
            if kw and kw.lower() in haystack:
                score += 1.0
        if score > best_score:
            best_score = score
            best_name = name
    return best_name, min(best_score, 1.0)


def get_template(name: str) -> BankTemplate:
    return TEMPLATES.get(name, TEMPLATES["generic"])
