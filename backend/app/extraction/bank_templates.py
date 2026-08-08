"""Pluggable bank templates.

Each template knows how to *recognise* a bank's statement and describes hints
that refine generic layout detection (date orientation, balance labels,
reference conventions). Adding a new bank is a data-only change here — the
core engine is untouched.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Label variants (normalised, lowercase) used to spot balance rows.
OPENING_LABELS = [
    "opening balance", "beginning balance", "balance b/f", "balance brought forward",
    "brought forward", "opening ledger balance", "opening", "bal b/f", "b/f",
    "balance b/fwd", "balance forward", "b/fwd",
]
CLOSING_LABELS = [
    "closing balance", "ending balance", "balance c/f", "balance carried forward",
    "carried forward", "closing ledger balance", "closing", "bal c/f", "c/f",
    "balance c/fwd", "c/fwd",
]
CARRIED_FORWARD_LABELS = [
    "balance c/f", "balance carried forward", "carried forward", "bal c/f",
    "balance c/fwd", "c/fwd", "c/f",
]
BROUGHT_FORWARD_LABELS = [
    "balance b/f", "balance brought forward", "brought forward", "bal b/f",
    "balance b/fwd", "b/fwd", "b/f", "balance forward",
]


def _sig_hit(signature: str, norm_line: str) -> bool:
    """Match a signature against a normalized line using word boundaries, so
    short names like 'uba' do not accidentally hit inside other words."""
    sig = signature.lower().strip()
    if not sig:
        return False
    if re.search(rf"\b{re.escape(sig)}\b", norm_line):
        return True
    return sig in norm_line


@dataclass
class BankTemplate:
    name: str
    signatures: list[str] = field(default_factory=list)
    date_day_first: bool = True
    reference_in_description: bool = False
    debit_is_negative: bool = False
    has_value_date: bool = False
    amount_columns: str = "debit_credit"

    def matches(self, text: str) -> float:
        """Return a confidence score in [0, 1] for a header block of text."""
        norm = text.lower()
        score = 0.0
        for sig in self.signatures:
            if sig.lower() in norm:
                score += 1.0
        return min(score, 1.0)


BANK_TEMPLATES: list[BankTemplate] = [
    BankTemplate(
        name="First Bank",
        signatures=["first bank", "firstbank", "first bank of nigeria"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Access Bank",
        signatures=["access bank", "accessbank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Zenith Bank",
        signatures=[
            "zenith bank",
            "zenithbank",
            "zenith international bank",
            "zenith",
        ],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="GTBank",
        signatures=["guaranty trust bank", "gtbank", "guaranty trust"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="UBA",
        signatures=["united bank for africa", " uba ", "uba bank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Fidelity Bank",
        signatures=["fidelity bank", "fidelitybank", "fidelity bank plc"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="FCMB",
        signatures=["first city monument bank", "fcmb"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Stanbic IBTC",
        signatures=["stanbic", "ibtc"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Sterling Bank",
        signatures=["sterling bank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Union Bank",
        signatures=["union bank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Wema Bank",
        signatures=["wema bank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Keystone Bank",
        signatures=["keystone bank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Ecobank",
        signatures=["ecobank", "eco bank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Polaris Bank",
        signatures=["polaris bank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Providus Bank",
        signatures=["providus"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Moniepoint",
        signatures=["moniepoint"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="Kuda",
        signatures=["kuda", "kuda bank", "kudabank"],
        amount_columns="debit_credit",
    ),
    BankTemplate(
        name="General (Auto)",
        signatures=[],
        amount_columns="debit_credit",
    ),
]


def get_supported_banks() -> list[str]:
    return [tpl.name for tpl in BANK_TEMPLATES]


def detect_bank(header_text: str) -> tuple[BankTemplate, float]:
    """Pick the best-matching bank template.

    Signature hits in the title/banner region (first few lines) are weighted
    far above hits in the data rows, so a mention of another bank inside a
    transaction description (e.g. "ATM WITHDRAWAL ZENITH BANK ABUJA") does not
    override the real statement banner.
    """
    lines = [ln for ln in header_text.splitlines() if ln.strip()]
    best = BANK_TEMPLATES[-1]
    best_score = 0.0
    for tpl in BANK_TEMPLATES[:-1]:
        score = 0.0
        for i, line in enumerate(lines):
            norm = line.lower()
            hits = sum(1 for sig in tpl.signatures if _sig_hit(sig, norm))
            if not hits:
                continue
            if i == 0:
                weight = 8.0
            elif i < 5:
                weight = 4.0
            elif i < 10:
                weight = 1.0
            else:
                weight = 0.15
            score += hits * weight
        if score > best_score:
            best, best_score = tpl, score
    return best, min(best_score, 1.0)


def label_is_opening(text: str) -> bool:
    norm = _label_norm(text)
    return any(lbl in norm for lbl in OPENING_LABELS)


def label_is_closing(text: str) -> bool:
    norm = _label_norm(text)
    return any(lbl in norm for lbl in CLOSING_LABELS)


def label_is_carried_forward(text: str) -> bool:
    norm = _label_norm(text)
    return any(lbl in norm for lbl in CARRIED_FORWARD_LABELS)


def label_is_brought_forward(text: str) -> bool:
    norm = _label_norm(text)
    return any(lbl in norm for lbl in BROUGHT_FORWARD_LABELS)


def _label_norm(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower()).strip()
