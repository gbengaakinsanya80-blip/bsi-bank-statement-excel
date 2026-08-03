"""Tests for rule-based transaction categorisation."""

from __future__ import annotations

from app.extraction.categorizer import DEFAULT_CATEGORY, categorize


def test_salary_beats_transfer_keyword() -> None:
    assert categorize("SALARY PAYMENT VIA NIP") == "Salary"


def test_salary_keywords() -> None:
    for desc in ("Salary", "WAGES PAYMENT", "PAYROLL CREDIT", "REMUNERATION JAN 2026"):
        assert categorize(desc) == "Salary"


def test_transfer() -> None:
    assert categorize("TRF/882244917/00 Transfer to ADEBAYO O") == "Transfer"
    assert categorize("NIP INWARD TRANSFER FROM FCMB") == "Transfer"


def test_pos_purchase() -> None:
    assert categorize("POS PURCHASE SHOPRITE IKEJA LAGOS") == "POS"


def test_atm_withdrawal() -> None:
    assert categorize("ATM WITHDRAWAL ZENITH BANK ABUJA") == "ATM"


def test_charges() -> None:
    assert categorize("BANK CHARGES FOR THE MONTH OF JANUARY") == "Charges"
    assert categorize("COMMISSION ON TURNOVER") == "Charges"


def test_interest() -> None:
    assert categorize("INTEREST PAID ON SAVINGS") == "Interest"


def test_bills() -> None:
    assert categorize("BILL PAYMENT DSTV SUBSCRIPTION") == "Bills"
    assert categorize("EKEDC PREPAID ELECTRICITY") == "Bills"


def test_refund() -> None:
    assert categorize("REFUND FROM ONLINE STORE") == "Refund"


def test_default_other() -> None:
    assert categorize("UNRECOGNISED RANDOM TEXT XYZ") == DEFAULT_CATEGORY
    assert categorize(None) == DEFAULT_CATEGORY
    assert categorize("") == DEFAULT_CATEGORY


def test_empty_description_stays_other() -> None:
    assert categorize("   ") == DEFAULT_CATEGORY
