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


def test_rent() -> None:
    assert categorize("RENT PAYMENT FOR JANUARY") == "Rent & Accommodation"


def test_utilities_bills() -> None:
    assert categorize("WATER BILL PAYMENT") == "Bills"
    assert categorize("MTN DATA SUBSCRIPTION") == "Bills"


def test_food_and_groceries() -> None:
    assert categorize("SHOPRITE IKEJA") == "Food & Groceries"
    assert categorize("RESTAURANT PAYMENT") == "Food & Groceries"


def test_fuel_and_transport() -> None:
    assert categorize("TOTAL PETROL STATION") == "Transport & Fuel"
    assert categorize("UBER RIDE") == "Transport & Fuel"


def test_education() -> None:
    assert categorize("SCHOOL FEES TERM 2") == "Education"


def test_health() -> None:
    assert categorize("PHARMACY PURCHASE") == "Health & Medical"


def test_customer_receipts_beats_transfer() -> None:
    assert categorize("PAYMENT RECEIVED FROM CLIENT XYZ") == "Customer Receipts"


def test_business_expense() -> None:
    assert categorize("OFFICE SUPPLIES PURCHASE") == "Business Expense"


def test_insurance() -> None:
    assert categorize("MOTOR INSURANCE PREMIUM") == "Insurance"


def test_entertainment() -> None:
    assert categorize("CINEMA TICKETS") == "Entertainment"


def test_donation() -> None:
    assert categorize("CHURCH TITHE") == "Donation & Charity"


def test_government() -> None:
    assert categorize("LASG TAX PAYMENT") == "Government & Authorities"


def test_loan_repayment_distinct_from_loan() -> None:
    assert categorize("LOAN REPAYMENT MONTHLY") == "Loan Repayment"
    assert categorize("LOAN DISBURSEMENT") == "Loan"


def test_word_boundaries_avoid_false_positives() -> None:
    assert categorize("POSITION STATEMENT") == DEFAULT_CATEGORY
    assert categorize("ATMOSPHERE PHOTOGRAPHY") == DEFAULT_CATEGORY
    assert categorize("TRANSFEROR ADMIN") == DEFAULT_CATEGORY
