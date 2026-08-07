"""Synthetic Nigerian bank statement generator.

Builds realistic, internally-consistent text PDF statements for the engine's
known bank layouts. Used by the test suite; real bank PDFs are never shipped.
"""

from __future__ import annotations

import random
from datetime import date, timedelta
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

DESCRIPTIONS = [
    "POS PURCHASE SHOPRITE IKEJA LAGOS",
    "TRF/882244917/00 Transfer to ADEBAYO O",
    "ATM WITHDRAWAL ZENITH BANK ABUJA",
    "SALARY PAYMENT VIA NIP",
    "MOBILE TRANSFER TO 09012345678",
    "BILL PAYMENT DSTV SUBSCRIPTION",
    "RTGS INWARD CLEARING FUNDS",
    "BANK CHARGES FOR THE MONTH OF",
    "INTEREST ON SAVINGS ACCOUNT",
    "NIP INWARD TRANSFER FROM FCMB",
]

SCHEMAS: dict[str, list[str]] = {
    "First Bank": ["Date", "Value Date", "Description", "Ref", "Debit", "Credit", "Balance"],
    "Access Bank": ["Date", "Description", "Reference", "Debit", "Credit", "Balance"],
    "Zenith Bank": ["Date", "Value Date", "Narration", "Ref", "Debit", "Credit", "Balance"],
    "GTBank": ["Date", "Value Date", "Description", "Ref", "Debit", "Credit", "Balance"],
    "UBA": ["Date", "Narration", "Reference", "Debit", "Credit", "Balance"],
    "Moniepoint": ["Date", "Description", "Reference", "Amount", "Balance"],
}

MULTI_LINE = {
    "POS PURCHASE SHOPRITE IKEJA LAGOS": ["POS PURCHASE", "SHOPRITE", "IKEJA LAGOS"],
    "TRF/882244917/00 Transfer to ADEBAYO O": ["TRF/882244917/00", "Transfer to ADEBAYO O"],
    "SALARY PAYMENT VIA NIP": ["SALARY PAYMENT", "VIA NIP"],
    "ATM WITHDRAWAL ZENITH BANK ABUJA": ["ATM WITHDRAWAL", "ZENITH BANK ABUJA"],
    "BILL PAYMENT DSTV SUBSCRIPTION": ["BILL PAYMENT", "DSTV SUBSCRIPTION"],
    "NIP INWARD TRANSFER FROM FCMB": ["NIP INWARD TRANSFER", "FROM FCMB"],
}

# Column width (mm) per column name, so shorter schemas get realistic widths.
COL_WIDTHS = {
    "Date": 22,
    "Value Date": 22,
    "Description": 62,
    "Narration": 62,
    "Ref": 24,
    "Reference": 26,
    "Debit": 26,
    "Credit": 26,
    "Balance": 28,
    "Amount": 26,
}


def _money(value: float) -> str:
    return f"{value:,.2f}"


def _fmt(d: date) -> str:
    return d.strftime("%d/%m/%y")


def generate_transactions(
    n: int,
    seed: int,
    start: date = date(2025, 1, 1),
    split_desc: bool = False,
    opening: float = 0.0,
) -> list[dict]:
    rng = random.Random(seed)
    balance = round(opening, 2)
    rows: list[dict] = []
    day = start
    for _ in range(n):
        day += timedelta(days=rng.randint(0, 4))
        desc = rng.choice(DESCRIPTIONS)
        is_credit = rng.random() < 0.42
        amount = round(rng.uniform(500, 500_000), 2)
        if is_credit:
            balance += amount
        else:
            balance -= amount
        balance = round(balance, 2)
        rows.append(
            {
                "date": day,
                "value_date": day + timedelta(days=rng.randint(0, 1)),
                "desc": desc,
                "ref": f"TXN{rng.randint(100000, 999999)}",
                "debit": None if is_credit else amount,
                "credit": amount if is_credit else None,
                "balance": balance,
                "split_desc": split_desc,
            }
        )
    return rows


def build_statement_pdf(
    path: str | Path,
    *,
    bank: str = "First Bank",
    account_name: str = "ADEBAYO OLUWASEUN",
    account_number: str = "0123456789",
    n_transactions: int = 60,
    rows_per_page: int = 18,
    split_desc: bool = False,
    opening: float = 500_000.00,
    seed: int = 7,
    zenith_style: bool = False,
) -> dict:
    """Build an internally consistent statement PDF. Returns the expected
    transaction list (ground truth) for tests.

    ``zenith_style`` mimics real Zenith statements: a "SUMMARY OF ACCOUNT"
    heading above the table and a "TOTAL AMOUNT <debits> <credits>" row before
    the closing balance row. Both must be ignored by the engine.
    """
    rng = random.Random(seed)
    schema = SCHEMAS.get(bank, SCHEMAS["First Bank"])
    txs = generate_transactions(n_transactions, seed=seed, split_desc=split_desc, opening=opening)
    closing = round(opening, 2)
    for t in txs:
        closing += (t["credit"] or 0.0) - (t["debit"] or 0.0)
    closing = round(closing, 2)

    def desc_cell(t: dict) -> str:
        text = t["desc"]
        if split_desc and text in MULTI_LINE:
            return "<br/>".join(MULTI_LINE[text])
        return text

    header_row = [Paragraph(f"<b>{c}</b>", _s()) for c in schema]
    data = [header_row]

    # Opening balance row
    if "Balance" in schema:
        row_map = {c: "" for c in schema}
        row_map["Date"] = ""
        row_map["Description"] = "OPENING BALANCE"
        row_map["Narration"] = "OPENING BALANCE"
        row_map["Balance"] = _money(opening)
        data.append([Paragraph(str(row_map.get(c, "")), _s()) for c in schema])

    for t in txs:
        row_map = {c: "" for c in schema}
        if "Date" in row_map:
            row_map["Date"] = _fmt(t["date"])
        if "Value Date" in row_map:
            row_map["Value Date"] = _fmt(t["value_date"])
        if "Description" in row_map:
            row_map["Description"] = desc_cell(t)
        if "Narration" in row_map:
            row_map["Narration"] = desc_cell(t)
        if "Ref" in row_map:
            row_map["Ref"] = t["ref"]
        if "Reference" in row_map:
            row_map["Reference"] = t["ref"]
        if "Debit" in row_map and t["debit"] is not None:
            row_map["Debit"] = _money(t["debit"])
        if "Credit" in row_map and t["credit"] is not None:
            row_map["Credit"] = _money(t["credit"])
        if "Amount" in row_map:
            amt = t["credit"] if t["credit"] is not None else -t["debit"]
            row_map["Amount"] = f"{amt:,.2f}"
        if "Balance" in row_map:
            row_map["Balance"] = _money(t["balance"])
        data.append([Paragraph(str(row_map.get(c, "")), _s()) for c in schema])

    closing_row = {c: "" for c in schema}
    closing_row["Description"] = "CLOSING BALANCE"
    closing_row["Narration"] = "CLOSING BALANCE"
    closing_row["Balance"] = _money(closing)
    data.append([Paragraph(str(closing_row.get(c, "")), _s()) for c in schema])

    if zenith_style:
        total_debit = sum(t["debit"] or 0.0 for t in txs)
        total_credit = sum(t["credit"] or 0.0 for t in txs)
        total_row = {c: "" for c in schema}
        total_row["Description"] = "TOTAL AMOUNT"
        total_row["Narration"] = "TOTAL AMOUNT"
        total_row["Debit"] = _money(total_debit) if total_debit else ""
        total_row["Credit"] = _money(total_credit) if total_credit else ""
        data.append([Paragraph(str(total_row.get(c, "")), _s()) for c in schema])
        # Move the total row to sit just before the closing balance row.
        data[-1], data[-2] = data[-2], data[-1]

    widths = [COL_WIDTHS[c] * mm for c in schema]
    table = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.grey),
        ("ALIGN", (0, 1), (-1, -1), "RIGHT"),
        ("ALIGN", (2, 1), (3, -1), "LEFT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 3),
        ("RIGHTPADDING", (0, 0), (-1, -1), 3),
    ]
    table.setStyle(TableStyle(style))

    doc = SimpleDocTemplate(
        str(path), pagesize=A4, leftMargin=10 * mm, rightMargin=10 * mm,
        topMargin=14 * mm, bottomMargin=14 * mm,
    )
    story = [
        Paragraph(f"<b>{bank}</b>", _title()),
        Spacer(1, 2 * mm),
        Paragraph("STATEMENT OF ACCOUNT", _s()),
        Spacer(1, 2 * mm),
        Paragraph(f"Account Name: {account_name}", _s()),
        Paragraph("Account Number: {account_number}", _s()),
        Paragraph(f"Period: {_fmt(date(2025, 1, 1))} - {_fmt(date(2025, 12, 31))}", _s()),
        Spacer(1, 4 * mm),
        table,
    ]
    if zenith_style:
        story.insert(3, Paragraph("SUMMARY OF ACCOUNT", _s()))
        story.insert(4, Spacer(1, 1 * mm))
    doc.build(story)

    expected = {
        "bank": bank,
        "account_name": account_name,
        "account_number": account_number,
        "opening": opening,
        "closing": closing,
        "transactions": [
            {
                "date": t["date"],
                "value_date": t.get("value_date"),
                "desc": t["desc"],
                "debit": t["debit"],
                "credit": t["credit"],
                "balance": t["balance"],
            }
            for t in txs
        ],
    }
    return expected


def build_scanned_statement_pdf(
    path: str | Path,
    *,
    bank: str = "First Bank",
    n_transactions: int = 25,
    dpi: int = 150,
) -> dict:
    """Build a text PDF then flatten it to images so the text layer is gone."""
    import fitz

    tmp = Path(str(path) + ".tmp.pdf")
    expected = build_statement_pdf(tmp, bank=bank, n_transactions=n_transactions)
    doc = fitz.open(str(tmp))
    out = fitz.open()
    for page in doc:
        pix = page.get_pixmap(dpi=dpi, alpha=False)
        img_path = str(tmp) + f".p{page.number}.png"
        pix.save(img_path)
        out.new_page(width=page.rect.width, height=page.rect.height)
        out[-1].insert_image(page.rect, filename=img_path)
    out.save(str(path))
    out.close()
    doc.close()
    tmp.unlink(missing_ok=True)
    import glob as _g

    for f in _g.glob(str(tmp) + ".p*.png"):
        try:
            Path(f).unlink()
        except OSError:
            pass
    return expected


def _s() -> ParagraphStyle:
    return ParagraphStyle("cell", fontSize=8, leading=9.5)


def _title() -> ParagraphStyle:
    return ParagraphStyle("title", fontSize=13, leading=15)
