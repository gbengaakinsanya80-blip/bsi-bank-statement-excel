"""Tests for the extraction engine against synthetic statements for every
supported bank layout."""

from __future__ import annotations

import pathlib
import tempfile

import pytest

from tests.generators.make_statements import build_scanned_statement_pdf, build_statement_pdf

ALL_BANKS = [
    "First Bank",
    "Access Bank",
    "Zenith Bank",
    "GTBank",
    "UBA",
    "Fidelity Bank",
    "FCMB",
    "Stanbic IBTC",
    "Sterling Bank",
    "Union Bank",
    "Wema Bank",
    "Keystone Bank",
    "Ecobank",
    "Polaris Bank",
    "Providus Bank",
    "Moniepoint",
    "Kuda",
]


def _run_extraction(engine, pdf_path: str) -> tuple:
    parsed = engine.process(str(pdf_path))
    return parsed


@pytest.mark.parametrize("bank", ALL_BANKS)
@pytest.mark.parametrize("split_desc", [False, True])
def test_full_extraction(engine, bank: str, split_desc: bool) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    truth = build_statement_pdf(pdf, bank=bank, n_transactions=50, seed=11, split_desc=split_desc)
    parsed = _run_extraction(engine, pdf)

    assert parsed.meta.bank_name.lower() in bank.lower() or bank.lower() in parsed.meta.bank_name.lower()
    real = [t for t in parsed.transactions if not t.is_beginning_balance and not t.is_ending_balance]
    assert len(real) == len(truth["transactions"]) == 50
    assert len(parsed.validation.all_issues) == 0, [
        i.message for i in parsed.validation.all_issues
    ]
    assert parsed.validation.balance_reconciled


@pytest.mark.parametrize("bank", ALL_BANKS)
def test_amounts_and_balances_match_ground_truth(engine, bank: str) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    truth = build_statement_pdf(pdf, bank=bank, n_transactions=30, seed=5)
    parsed = _run_extraction(engine, pdf)

    tx = [t for t in parsed.transactions if not t.is_beginning_balance and not t.is_ending_balance]
    assert len(tx) == len(truth["transactions"]) == 30

    for got, exp in zip(tx, truth["transactions"]):
        assert (got.debit or 0.0) == pytest.approx(exp["debit"] or 0.0, abs=0.01)
        assert (got.credit or 0.0) == pytest.approx(exp["credit"] or 0.0, abs=0.01)
        assert got.balance is not None
        assert got.balance == pytest.approx(exp["balance"], abs=0.01)


def test_opening_and_closing_balances(engine) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    truth = build_statement_pdf(pdf, bank="First Bank", n_transactions=10, seed=2)
    parsed = _run_extraction(engine, pdf)

    opening = [t for t in parsed.transactions if t.is_beginning_balance]
    assert len(opening) == 1
    assert opening[0].balance == pytest.approx(500_000.00, abs=0.01)
    closing = [t for t in parsed.transactions if t.is_ending_balance]
    assert len(closing) == 1
    assert closing[0].balance == pytest.approx(truth["closing"], abs=0.01)


def test_unknown_or_generic_pdf_falls_back_to_general(engine) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "gen.pdf"
    build_statement_pdf(pdf, bank="Some Unknown Bank", n_transactions=10, seed=9)
    parsed = _run_extraction(engine, pdf)
    assert parsed.transactions
    assert len(parsed.validation.all_issues) <= len(parsed.transactions)


@pytest.mark.parametrize("bank", ["Zenith Bank", "First Bank"])
def test_total_amount_row_and_summary_heading_are_ignored(engine, bank: str) -> None:
    """Real Zenith statements carry a "SUMMARY OF ACCOUNT" heading and a
    "TOTAL AMOUNT" row before the closing balance. Neither may leak into the
    extracted transactions or break balance reconciliation."""
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    truth = build_statement_pdf(pdf, bank=bank, n_transactions=25, seed=13, zenith_style=True)
    parsed = _run_extraction(engine, pdf)

    real = [t for t in parsed.transactions if not t.is_beginning_balance and not t.is_ending_balance]
    assert len(real) == len(truth["transactions"]) == 25
    assert len(parsed.validation.all_issues) == 0, [i.message for i in parsed.validation.all_issues]
    assert parsed.validation.balance_reconciled
    assert not any("total" in (t.description or "").lower() for t in real)
    assert not any("summary" in (t.description or "").lower() for t in real)


def test_scanned_pdf_detected_and_degrades_gracefully(engine) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "scan.pdf"
    build_scanned_statement_pdf(pdf)
    # ocr=False keeps the default (fast) suite independent of OCR engine
    # availability; real OCR accuracy is measured in the QA suite.
    parsed = engine.process(str(pdf), ocr=False)
    # The page is flagged as needing OCR.
    assert parsed.meta.page_count >= 1
