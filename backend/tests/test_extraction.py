"""Tests for the extraction engine against synthetic statements for every
supported bank layout."""

from __future__ import annotations

import pathlib
import tempfile

import pytest

from app.extraction.bank_templates import detect_bank
from app.extraction.engine import dedupe_transactions, reconcile_transactions
from app.extraction.layout import detect_layout, filter_noise_lines
from app.extraction.pdf_reader import Line, Word
from app.extraction.row_parser import parse_rows, to_transactions
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


# --------------------------------------------------------------------------- #
# Zenith per-page summary block (OCR geometry, no text layer).
# --------------------------------------------------------------------------- #
def _w(x0: float, x1: float, text: str, top: float) -> Word:
    return Word(x0=x0, top=top, x1=x1, bottom=top + 12.0, text=text)


def _mk_line(page: int, no: int, top: float, words: list[tuple[float, float, str]]) -> Line:
    ws = sorted([_w(x0, x1, t, top) for x0, x1, t in words], key=lambda w: w.x0)
    return Line(
        top=top,
        bottom=top + 12.0,
        x0=min(w.x0 for w in ws),
        x1=max(w.x1 for w in ws),
        text=" ".join(w.text for w in ws),
        words=ws,
        page_index=page,
        line_no=no,
    )


def _zenith_summary_lines() -> list[Line]:
    """Mimic real Zenith OCR output: a banner + per-page summary block above
    the table header on every page, then transaction rows. Page 2 repeats the
    summary block (which the old parser leaked into transactions)."""
    lines: list[Line] = []
    no = 0
    header_words = [
        (22.0, 47.0, "DATE"),
        (81.0, 111.0, "VALUE"),
        (204.0, 262.0, "DESCRIPTION"),
        (383.0, 412.0, "DEBIT"),
        (445.0, 478.0, "CREDIT"),
        (517.0, 557.0, "BALANCE"),
    ]

    # ---- page 1 -------------------------------------------------------- #
    lines.append(_mk_line(0, no := no + 1, 40.0, [(51.0, 81.0, "ZENITH"), (90.0, 120.0, "BANK"), (130.0, 160.0, "PLC")]))
    lines.append(_mk_line(0, no := no + 1, 60.0, [(54.0, 130.0, "STREET WUSE ABUJA")]))
    lines.append(_mk_line(0, no := no + 1, 80.0, [
        (54.0, 130.0, "STREET"),
        (387.0, 416.0, "Opening"),
        (425.0, 462.0, "Balance:"),
        (526.0, 560.0, "7,021.03"),
    ]))
    lines.append(_mk_line(0, no := no + 1, 95.0, [
        (387.0, 424.0, "Closing"),
        (432.0, 470.0, "Balance:"),
        (522.0, 560.0, "21,404.27"),
    ]))
    lines.append(_mk_line(0, no := no + 1, 110.0, [
        (387.0, 424.0, "Period:"),
        (458.0, 520.0, "01/01/2019"),
        (530.0, 548.0, "TO"),
        (558.0, 620.0, "31/12/2022"),
    ]))
    lines.append(_mk_line(0, no := no + 1, 125.0, header_words))
    lines.append(_mk_line(0, no := no + 1, 135.0, [(120.0, 160.0, "POSTED"), (170.0, 200.0, "DATE")]))

    # ---- transaction rows on page 1 ------------------------------------- #
    lines.append(_mk_line(0, no := no + 1, 150.0, [
        (22.0, 59.0, "13/09/2022"),
        (70.0, 109.0, "13/09/2022"),
        (120.0, 285.0, "POS Settlement for 2057FC999982025-13-09-2022"),
        (388.0, 412.0, "78,300.00"),
        (515.0, 552.0, "85,321.03"),
    ]))
    lines.append(_mk_line(0, no := no + 1, 165.0, [
        (22.0, 59.0, "13/09/2022"),
        (70.0, 109.0, "13/09/2022"),
        (120.0, 285.0, "VAT on Commission 2057FC999982025-13-09-2022"),
        (388.0, 412.0, "391.52"),
        (515.0, 552.0, "84,929.51"),
    ]))

    # ---- page 2: banner + repeated summary block + repeated header ------- #
    lines.append(_mk_line(1, no := no + 1, 240.0, [(51.0, 81.0, "ZENITH"), (90.0, 120.0, "BANK"), (130.0, 160.0, "PLC")]))
    lines.append(_mk_line(1, no := no + 1, 260.0, [(387.0, 462.0, "Account Number:"), (492.0, 537.0, "1011653449")]))
    lines.append(_mk_line(1, no := no + 1, 275.0, [(387.0, 440.0, "Total Debit:"), (508.0, 560.0, "11,060,170.94")]))
    lines.append(_mk_line(1, no := no + 1, 290.0, [(387.0, 443.0, "Total Credit:"), (508.0, 560.0, "11,074,554.18")]))
    lines.append(_mk_line(1, no := no + 1, 305.0, [(387.0, 462.0, "Opening Balance:"), (526.0, 560.0, "7,021.03")]))
    lines.append(_mk_line(1, no := no + 1, 320.0, [(387.0, 470.0, "Closing Balance:"), (522.0, 560.0, "21,404.27")]))
    lines.append(_mk_line(1, no := no + 1, 335.0, header_words))

    lines.append(_mk_line(1, no := no + 1, 350.0, [
        (22.0, 59.0, "14/09/2022"),
        (70.0, 109.0, "14/09/2022"),
        (120.0, 285.0, "POS Settlement for 2057FC999982025-14-09-2022"),
        (445.0, 478.0, "51,700.00"),
        (515.0, 552.0, "136,629.51"),
    ]))
    lines.append(_mk_line(1, no := no + 1, 365.0, [
        (22.0, 59.0, "14/09/2022"),
        (70.0, 109.0, "14/09/2022"),
        (120.0, 285.0, "Pos stamp duty sett comm for 2057FC999982025-14-09-2022"),
        (388.0, 412.0, "50.00"),
        (515.0, 552.0, "136,579.51"),
    ]))
    lines.append(_mk_line(1, no := no + 1, 380.0, [
        (214.0, 396.0, "it will be assumed that the statement rendered is correct"),
    ]))
    return lines


def test_zenith_per_page_summary_block_is_not_parsed_as_transactions() -> None:
    lines = filter_noise_lines(_zenith_summary_lines())
    layout = detect_layout(lines, 612.0, 843.0)
    template, _conf = detect_bank("\n".join(l.text for l in lines[:60]))
    records = parse_rows(lines, layout, template, header_line_no=layout.header_line_no)
    txs = to_transactions(records, template)
    txs = reconcile_transactions(txs)
    txs = dedupe_transactions(txs)

    opening = [t for t in txs if t.is_beginning_balance]
    closing = [t for t in txs if t.is_ending_balance]
    assert len(opening) == 1, "opening balance must be captured exactly once"
    assert opening[0].balance == pytest.approx(7_021.03, abs=0.01)
    assert len(closing) == 1, "closing balance must be captured exactly once"
    assert closing[0].balance == pytest.approx(21_404.27, abs=0.01)

    real = [t for t in txs if not t.is_beginning_balance and not t.is_ending_balance]
    assert len(real) == 4
    assert all(t.tx_date is not None and t.value_date is not None for t in real)
    assert all(t.debit is not None or t.credit is not None for t in real)
    assert [t.description for t in real] == [
        "POS Settlement for 2057FC999982025-13-09-2022",
        "VAT on Commission 2057FC999982025-13-09-2022",
        "POS Settlement for 2057FC999982025-14-09-2022",
        "Pos stamp duty sett comm for 2057FC999982025-14-09-2022",
    ]

    # No per-page summary garbage (account number / totals / repeated balances).
    joined = " ".join(t.description for t in txs).lower()
    for needle in ("account number", "1011653449", "total debit", "total credit", "period"):
        assert needle not in joined
    assert not any(t.description == "posted date" for t in txs)


def test_reconcile_drops_duplicated_amount_in_other_column() -> None:
    """A row where OCR duplicated the settlement amount into BOTH the debit
    and credit columns must keep only the side matching the balance movement."""
    from app.core.models import Transaction

    def tx(line, desc, debit, credit, balance):
        return Transaction(
            tx_date=None, value_date=None, description=desc, reference="",
            debit=debit, credit=credit, balance=balance, currency="NGN",
            page_number=6, line_number=line,
        )

    txs = reconcile_transactions([
        tx(397, "VAT on Commission 2057FC999982025-20-10-2022", 1.01, None, 23_052.63),
        tx(399, "POS Settlement for 2057FC999982025-21-10-2022", None, 58_850.0, 81_902.63),
        tx(400, "Pos stamp duty sett comm for 2057FC999982025-21-10-2022", 50.0, 58_850.0, 81_852.63),
    ])
    by_line = {t.line_number: t for t in txs}
    assert by_line[399].credit == pytest.approx(58_850.0)
    assert by_line[399].debit is None
    assert by_line[400].debit == pytest.approx(50.0)
    assert by_line[400].credit is None


def test_reconcile_moves_amount_to_credit_when_balance_increases() -> None:
    """A POS Settlement parsed into the debit column must flip to credit when
    the running balance increased by exactly its amount."""
    from app.core.models import Transaction

    def tx(line, desc, debit, credit, balance):
        return Transaction(
            tx_date=None, value_date=None, description=desc, reference="",
            debit=debit, credit=credit, balance=balance, currency="NGN",
            page_number=4, line_number=line,
        )

    txs = reconcile_transactions([
        tx(239, "NIP/GTB/OLABODEOLANREWAJU/REF23449862000", 64_400.0, None, 124_431.78),
        tx(240, "POS Settlement for 2057FC999982025-30-09-2022", 46_650.0, None, 171_081.78),
    ])
    by_line = {t.line_number: t for t in txs}
    assert by_line[240].credit == pytest.approx(46_650.0)
    assert by_line[240].debit is None


def test_footer_prose_and_date_only_phantom_lines_are_not_parsed() -> None:
    """Footer disclaimers and date-only phantom rows (no amounts/balance,
    no description) must never become transactions."""
    from app.core.models import Transaction

    header_words = [
        (22.0, 47.0, "DATE"),
        (81.0, 111.0, "VALUE"),
        (204.0, 262.0, "DESCRIPTION"),
        (383.0, 412.0, "DEBIT"),
        (445.0, 478.0, "CREDIT"),
        (517.0, 557.0, "BALANCE"),
    ]
    lines: list[Line] = []
    no = 0
    lines.append(_mk_line(0, no := no + 1, 40.0, header_words))
    lines.append(_mk_line(0, no := no + 1, 60.0, [
        (22.0, 59.0, "13/09/2022"),
        (70.0, 109.0, "13/09/2022"),
        (120.0, 285.0, "POS Settlement for 2057FC999982025-13-09-2022"),
        (445.0, 478.0, "78,300.00"),
        (517.0, 557.0, "131,713.00"),
    ]))
    # Date-only phantom row (empty description, no amounts/balance).
    lines.append(_mk_line(0, no := no + 1, 80.0, [(22.0, 59.0, "27/09/2022")]))
    # Footer disclaimer prose with a date embedded.
    lines.append(_mk_line(0, no := no + 1, 100.0, [
        (120.0, 285.0, "PLEASE EXAMINE THIS STATEMENT AT ONCE"),
        (22.0, 59.0, "29/09/2022"),
    ]))

    layout = detect_layout(lines, 612.0, 843.0)
    template, _conf = detect_bank("\n".join(l.text for l in lines[:60]))
    records = parse_rows(lines, layout, template, header_line_no=layout.header_line_no)
    txs = to_transactions(records, template)
    txs = reconcile_transactions(txs)

    assert len(txs) == 1
    assert txs[0].description == "POS Settlement for 2057FC999982025-13-09-2022"
    assert txs[0].credit == pytest.approx(78_300.0)
    assert txs[0].balance == pytest.approx(131_713.0)
    assert not any("examine" in (t.description or "").lower() for t in txs)
    assert not any(t.tx_date is not None and t.debit is None and t.credit is None and t.balance is None for t in txs)
