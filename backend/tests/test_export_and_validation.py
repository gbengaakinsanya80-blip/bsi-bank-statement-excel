"""Tests for validation, summary stats and export formats."""

from __future__ import annotations

import pathlib
import tempfile

import pytest

from app.core.models import Transaction, ValidationIssue
from app.export.csv_json import to_csv, to_json
from app.export.excel import build_excel
from app.export.pdf_summary import to_pdf_summary
from app.services.pipeline import build_export_bytes, rehydrate_parsed
from app.services.stats import compute_summary
from app.validation.checks import validate_statement
from tests.generators.make_statements import build_statement_pdf


def test_compute_summary_counts_and_totals() -> None:
    txs = [
        Transaction(tx_date=None, description="A", debit=100.0, balance=900.0, tx_type="Debit"),
        Transaction(tx_date=None, description="B", credit=50.0, balance=950.0, tx_type="Credit"),
        Transaction(tx_date=None, description="C", debit=25.5, balance=924.5, tx_type="Debit"),
    ]
    s = compute_summary(txs, currency="NGN")
    assert s.total_debits == pytest.approx(125.5)
    assert s.total_credits == pytest.approx(50.0)
    assert s.total_debit_count == 2
    assert s.total_credit_count == 1
    assert s.largest_debit == pytest.approx(100.0)
    assert s.largest_credit == pytest.approx(50.0)
    assert s.average_debit == pytest.approx(62.75)


def test_validate_statement_balance_reconciliation() -> None:
    txs = [
        Transaction(tx_date=None, description="OPENING BALANCE", balance=500.0, is_beginning_balance=True),
        Transaction(tx_date=None, description="A", debit=100.0, balance=400.0, tx_type="Debit"),
    ]
    from app.core.models import SummaryStats

    summary = SummaryStats(opening_balance=500.0, closing_balance=400.0, total_debits=100.0)
    report = validate_statement(txs, summary, ocr_confidence=None)
    assert report.balance_reconciled


def test_validate_statement_flags_missing_balance() -> None:
    txs = [
        Transaction(tx_date=None, description="A", debit=100.0, balance=None, tx_type="Debit"),
    ]
    from app.core.models import SummaryStats

    summary = SummaryStats()
    report = validate_statement(txs, summary, ocr_confidence=None)
    assert report.unreadable_transactions or report.balance_errors or report.other_issues


def _parsed_fixture(engine, bank: str = "First Bank", n: int = 20):
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    build_statement_pdf(pdf, bank=bank, n_transactions=n, seed=4)
    return engine.process(str(pdf))


def test_excel_export(engine) -> None:
    parsed = _parsed_fixture(engine)
    data = build_excel(parsed).getvalue()
    assert data.startswith(b"PK")  # xlsx is a zip
    assert len(data) > 1000


def test_csv_export(engine) -> None:
    parsed = _parsed_fixture(engine)
    data = to_csv(parsed)
    lines = data.decode("utf-8-sig").strip().splitlines()
    assert len(lines) == len(parsed.transactions) + 1
    assert lines[0].startswith("Beginning Balance,Date")


def test_json_export(engine) -> None:
    parsed = _parsed_fixture(engine)
    data = to_json(parsed)
    import json

    doc = json.loads(data)
    assert len(doc["transactions"]) == len(parsed.transactions)
    assert doc["validation"]["total_issues"] >= 0


def test_pdf_summary_export(engine) -> None:
    parsed = _parsed_fixture(engine)
    data = to_pdf_summary(parsed)
    assert data.startswith(b"%PDF")


@pytest.mark.parametrize("fmt", ["xlsx", "csv", "json", "pdf", "sqlite"])
def test_build_export_bytes(engine, fmt: str) -> None:
    parsed = _parsed_fixture(engine)
    data = build_export_bytes(parsed, fmt)
    assert len(data) > 100


def test_rehydrate_roundtrip(engine) -> None:
    parsed = _parsed_fixture(engine)
    as_dict = parsed.to_dict()
    rehydrated = rehydrate_parsed(as_dict)
    assert len(rehydrated.transactions) == len(parsed.transactions)
    assert rehydrated.meta.bank_name == parsed.meta.bank_name
    assert rehydrated.summary.closing_balance == pytest.approx(parsed.summary.closing_balance)
    assert rehydrated.validation.balance_reconciled == parsed.validation.balance_reconciled
    assert rehydrated.transactions[0].description == parsed.transactions[0].description
