"""PDF rendering of the financial statements (reportlab).

Turns the report dicts produced by ``app.accounting.statements`` into a
print-ready A4 PDF: income statement, balance sheet or cash flow, each with
the company name and a period label, formatted with the same visual language
as the statement-summary export.
"""

from __future__ import annotations

from datetime import date
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

NAVY = colors.HexColor("#1F4E79")
LIGHT = colors.HexColor("#EAF1F8")
GREY = colors.HexColor("#F2F2F2")

REPORT_TITLES = {
    "income-statement": "Income Statement",
    "balance-sheet": "Balance Sheet",
    "cash-flow": "Cash Flow Statement",
}


def build_report_pdf(*, company: dict[str, Any], report_kind: str, data: dict[str, Any]) -> bytes:
    """Render one financial statement report as PDF bytes."""
    title = REPORT_TITLES[report_kind]
    styles = getSampleStyleSheet()
    bio = BytesIO()
    doc = SimpleDocTemplate(
        bio, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
    )

    story = [
        Paragraph("FinancePilot AI", styles["Title"]),
        Paragraph(title, styles["Heading2"]),
        Paragraph(
            f"{company.get('name') or company.get('trading_name') or 'Company'}",
            styles["Normal"],
        ),
        Paragraph(_period_label(data), styles["Normal"]),
        Spacer(1, 6 * mm),
    ]

    if report_kind == "income-statement":
        _append_income(story, data)
    elif report_kind == "balance-sheet":
        _append_balance_sheet(story, data)
    else:
        _append_cash_flow(story, data)

    story.append(Spacer(1, 4 * mm))
    note = ParagraphStyle(
        name="ReportNote",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#666666"),
    )
    story.append(Paragraph(
        f"Generated {date.today().isoformat()} — amounts in Naira (NGN).",
        note,
    ))
    doc.build(story)
    return bio.getvalue()


# ---------------------------------------------------------------------- #
# Income statement
# ---------------------------------------------------------------------- #
def _append_income(story, data: dict[str, Any]) -> None:
    rows: list[list[Any]] = []
    _section_header(rows, "Revenue")
    for item in data.get("revenue", []):
        rows.append([_acct(item), _fmt(item["balance"])])
    _subtotal(rows, "Total Revenue", data.get("total_revenue", 0))
    _section_header(rows, "Expenses")
    for item in data.get("expenses", []):
        rows.append([_acct(item), _fmt(item["balance"])])
    _subtotal(rows, "Total Expenses", data.get("total_expenses", 0))
    _subtotal(rows, "Net Profit", data.get("net_profit", 0))
    _emit(story, rows)


# ---------------------------------------------------------------------- #
# Balance sheet
# ---------------------------------------------------------------------- #
def _append_balance_sheet(story, data: dict[str, Any]) -> None:
    rows: list[list[Any]] = []
    _section_header(rows, "Assets")
    for item in data.get("assets", []):
        rows.append([_acct(item), _fmt(item["balance"])])
    _subtotal(rows, "Total Assets", data.get("total_assets", 0))
    _section_header(rows, "Liabilities")
    for item in data.get("liabilities", []):
        rows.append([_acct(item), _fmt(item["balance"])])
    _subtotal(rows, "Total Liabilities", data.get("total_liabilities", 0))
    _section_header(rows, "Equity")
    for item in data.get("equity", []):
        rows.append([_acct(item), _fmt(item["balance"])])
    rows.append(["Current Year Profit", _fmt(data.get("current_year_profit", 0))])
    balancing = float(data.get("balancing_figure", 0))
    if balancing != 0:
        rows.append(["Balancing Figure", _fmt(balancing)])
    _subtotal(rows, "Total Equity", data.get("total_equity", 0))
    _emit(story, rows)


# ---------------------------------------------------------------------- #
# Cash flow
# ---------------------------------------------------------------------- #
def _append_cash_flow(story, data: dict[str, Any]) -> None:
    rows: list[list[Any]] = []
    op = data.get("operating", {})
    _section_header(rows, "Operating Activities")
    rows.append(["Net Profit", _fmt(op.get("net_profit", 0))])
    for item in op.get("adjustments", []):
        rows.append([f"Adjustment — {_acct(item)}", _fmt(item.get("change", 0))])
    _subtotal(rows, "Net Cash from Operating Activities", op.get("net_cash", 0))

    inv = data.get("investing", {})
    _section_header(rows, "Investing Activities")
    for item in inv.get("items", []):
        rows.append([_acct(item), _fmt(item.get("change", 0))])
    _subtotal(rows, "Net Cash from Investing Activities", inv.get("net_cash", 0))

    fin = data.get("financing", {})
    _section_header(rows, "Financing Activities")
    for item in fin.get("items", []):
        rows.append([_acct(item), _fmt(item.get("change", 0))])
    _subtotal(rows, "Net Cash from Financing Activities", fin.get("net_cash", 0))

    rows.append(["Net Increase in Cash", _fmt(data.get("net_increase_in_cash", 0))])
    _subtotal(rows, "Closing Cash", data.get("closing_cash", 0))
    _emit(story, rows)


# ---------------------------------------------------------------------- #
# Shared helpers
# ---------------------------------------------------------------------- #
def _emit(story, rows: list[list[Any]]) -> None:
    table = Table(rows, colWidths=[120 * mm, 54 * mm])
    table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    for idx, row in enumerate(rows):
        if isinstance(row, _Section):
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, idx), (-1, idx), NAVY),
                ("TEXTCOLOR", (0, idx), (-1, idx), colors.white),
                ("FONTNAME", (0, idx), (-1, idx), "Helvetica-Bold"),
            ]))
        elif isinstance(row, _Subtotal):
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, idx), (-1, idx), GREY),
                ("FONTNAME", (0, idx), (-1, idx), "Helvetica-Bold"),
                ("LINEABOVE", (0, idx), (-1, idx), 0.8, colors.HexColor("#444444")),
            ]))
    story.append(table)


class _Section(list):
    """Section header row (navy background)."""


class _Subtotal(list):
    """Subtotal / total row (grey background, bold)."""


def _section_header(rows: list[list[Any]], label: str) -> None:
    rows.append(_Section([label, ""]))


def _subtotal(rows: list[list[Any]], label: str, value: Any, ) -> None:
    rows.append(_Subtotal([label, _fmt(value)]))


def _acct(item: dict[str, Any]) -> str:
    code = item.get("code", "")
    name = item.get("name", "")
    return f"{code} — {name}" if code else name


def _fmt(value) -> str:
    if value is None:
        return "—"
    try:
        return f"{float(value):,.2f}"
    except (TypeError, ValueError):
        return str(value)


def _period_label(data: dict[str, Any]) -> str:
    period = data.get("period_id")
    return f"Period: {period}" if period else "Period: All time (entire ledger)"
