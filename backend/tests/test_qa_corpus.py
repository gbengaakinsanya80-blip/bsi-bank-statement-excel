"""PRD QA suite: 200+ synthetic sample statements across every bank layout.

Each statement is generated with a known ground truth, parsed, and checked for
exact transaction count, exact debit/credit/balance values, and zero validation
issues. OCR accuracy is measured when an OCR backend is available.

This is the heavy suite (marked ``qa``). The fast default suite stays in
test_extraction.py. Run explicitly with:  pytest -m qa
"""

from __future__ import annotations

import pathlib
import tempfile
import time

import pytest

from app.extraction.ocr import get_available_backend
from tests.generators.make_statements import build_scanned_statement_pdf, build_statement_pdf
from tests.test_extraction import ALL_BANKS

pytestmark = pytest.mark.qa

# 17 banks x 12 seeds x 25 transactions = 204 distinct statements.
_CORPUS = [(bank, seed, 25) for bank in ALL_BANKS for seed in range(1, 13)]
_OCR_BANKS = ["First Bank", "Access Bank", "Zenith Bank", "GTBank", "UBA", "Moniepoint"]
_REPORT: list[dict] = []


def _run(engine, pdf, ocr: bool = True) -> tuple:
    parsed = engine.process(str(pdf), ocr=ocr)
    real = [
        t for t in parsed.transactions
        if not t.is_beginning_balance and not t.is_ending_balance
    ]
    return parsed, real


@pytest.mark.parametrize("bank,seed,n", _CORPUS)
def test_corpus_exact_extraction(engine, bank: str, seed: int, n: int) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    truth = build_statement_pdf(pdf, bank=bank, n_transactions=n, seed=seed)
    t0 = time.perf_counter()
    parsed, real = _run(engine, pdf)
    elapsed = time.perf_counter() - t0

    assert len(real) == len(truth["transactions"]) == n
    assert parsed.validation.balance_reconciled
    assert len(parsed.validation.all_issues) == 0, [
        i.message for i in parsed.validation.all_issues
    ]
    amount_ok = 0
    balance_ok = 0
    for got, exp in zip(real, truth["transactions"]):
        if (got.debit or 0.0) == pytest.approx(exp["debit"] or 0.0, abs=0.01) and (
            got.credit or 0.0
        ) == pytest.approx(exp["credit"] or 0.0, abs=0.01):
            amount_ok += 1
        if got.balance is not None and got.balance == pytest.approx(exp["balance"], abs=0.01):
            balance_ok += 1
    _REPORT.append(
        {
            "bank": bank, "n": n, "got": len(real), "amount": amount_ok,
            "balance": balance_ok, "seconds": elapsed,
        }
    )


@pytest.mark.parametrize("bank", ALL_BANKS)
def test_corpus_multiline_descriptions_merge(engine, bank: str) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "stmt.pdf"
    truth = build_statement_pdf(pdf, bank=bank, n_transactions=30, seed=17, split_desc=True)
    parsed, real = _run(engine, pdf)

    assert len(real) == 30
    assert len(parsed.validation.all_issues) == 0
    for got, exp in zip(real, truth["transactions"]):
        joined = got.description.replace(" ", "").upper()
        expected = exp["desc"].replace(" ", "").upper()
        assert joined == expected, f"{got.description!r} != {exp['desc']!r}"


@pytest.mark.parametrize("bank", _OCR_BANKS)
def test_qa_ocr_accuracy(engine, bank: str) -> None:
    backend = get_available_backend()
    if backend is None:
        pytest.skip("No OCR backend available on this machine.")
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "scan.pdf"
    truth = build_scanned_statement_pdf(pdf, bank=bank, n_transactions=10)
    t0 = time.perf_counter()
    parsed, real = _run(engine, pdf)
    elapsed = time.perf_counter() - t0

    expected = truth["transactions"]
    count_rate = min(len(real), len(expected)) / max(len(real), len(expected)) if expected else 0.0
    amount_ok = sum(
        1 for t, e in zip(real, expected)
        if (t.debit or 0.0) == pytest.approx(e["debit"] or 0.0, abs=0.01)
        and (t.credit or 0.0) == pytest.approx(e["credit"] or 0.0, abs=0.01)
    )
    rate = amount_ok / len(expected) if expected else 0.0
    _REPORT.append({"bank": bank, "n": len(expected), "got": len(real), "amount": amount_ok, "balance": amount_ok, "seconds": elapsed, "ocr": True})
    assert count_rate >= 0.8, f"OCR count accuracy {count_rate:.0%} < 80%"
    assert rate >= 0.8, f"OCR field accuracy {rate:.0%} < 80%"


def test_large_multipage_statement_performance(engine) -> None:
    tmp = pathlib.Path(tempfile.mkdtemp())
    pdf = tmp / "large.pdf"
    truth = build_statement_pdf(
        pdf, bank="First Bank", n_transactions=600, rows_per_page=25, split_desc=True, seed=21
    )
    t0 = time.perf_counter()
    parsed, real = _run(engine, pdf)
    elapsed = time.perf_counter() - t0

    assert len(real) == 600 == len(truth["transactions"])
    assert parsed.validation.balance_reconciled
    assert len(parsed.validation.all_issues) == 0
    # PRD performance: 1 page in under 2 seconds.
    per_page = elapsed / max(parsed.meta.page_count, 1)
    assert per_page < 2.0, f"{elapsed:.2f}s over {parsed.meta.page_count} pages = {per_page:.2f}s/page"


def test_qa_report() -> None:
    """Aggregate PRD success criteria across the whole corpus."""
    text = [m for m in _REPORT if not m.get("ocr")]
    ocr = [m for m in _REPORT if m.get("ocr")]
    assert len(text) >= 200, f"QA corpus too small: {len(text)}"

    total = len(text)
    count_ok = sum(1 for m in text if m["got"] == m["n"])
    amount = sum(m["amount"] for m in text) / total
    balance = sum(m["balance"] for m in text) / total
    total_time = sum(m["seconds"] for m in text)

    report = [
        f"QA corpus: {total} statements, {sum(m['n'] for m in text)} transactions",
        f"  transaction count accuracy: {count_ok}/{total} ({count_ok / total:.2%})",
        f"  field amount accuracy: {amount:.2%}",
        f"  field balance accuracy: {balance:.2%}",
        f"  total time: {total_time:.1f}s, avg {total_time / total:.2f}s/statement",
    ]
    if ocr:
        o_total = len(ocr)
        report.append(
            f"OCR corpus: {o_total} scanned statements, count accuracy "
            f"{sum(1 for m in ocr if m['got'] == m['n']) / o_total:.2%}, "
            f"field accuracy {sum(m['amount'] for m in ocr) / o_total:.2%}"
        )
    print("\n===== BSI QA REPORT =====")
    print("\n".join(report))
    print("==========================")

    assert count_ok == total, "PRD: 100% transaction count accuracy"
    assert amount >= 0.999, f"PRD: 99.9% field accuracy, got {amount:.2%}"
    assert balance >= 0.999, f"PRD: 99.9% balance accuracy, got {balance:.2%}"
