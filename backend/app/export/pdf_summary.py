"""PDF summary export (reportlab)."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.core.models import ParsedStatement


def to_pdf_summary(parsed: ParsedStatement) -> bytes:
    styles = getSampleStyleSheet()
    bio = BytesIO()
    doc = SimpleDocTemplate(
        bio, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
    )
    meta = parsed.meta
    s = parsed.summary

    story = [
        Paragraph("Bank Statement Intelligence", styles["Title"]),
        Paragraph("Statement Summary Report", styles["Heading2"]),
        Spacer(1, 4 * mm),
    ]

    header_rows = [
        ("Bank", meta.bank_name),
        ("Account Name", meta.account_name or "—"),
        ("Account Number", meta.account_number or "—"),
        ("Period", f"{meta.period_start or '—'} to {meta.period_end or '—'}"),
        ("Pages", str(meta.page_count)),
        ("Extraction Method", meta.extraction_method),
        ("OCR Used", "Yes" if meta.ocr_used else "No"),
        ("Parse Time", f"{meta.parse_time_seconds}s"),
    ]
    header_table = Table(header_rows, colWidths=[42 * mm, 110 * mm])
    header_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#EAF1F8")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Summary", styles["Heading2"]))
    summary_rows = [
        ("Opening Balance", _fmt(s.opening_balance)),
        ("Closing Balance", _fmt(s.closing_balance)),
        ("Total Credits", _fmt(s.total_credits)),
        ("Total Debits", _fmt(s.total_debits)),
        ("Number of Transactions", str(s.number_of_transactions)),
        ("Largest Debit", _fmt(s.largest_debit)),
        ("Largest Credit", _fmt(s.largest_credit)),
        ("Average Debit", _fmt(s.average_debit)),
        ("Average Credit", _fmt(s.average_credit)),
        ("Balance Reconciled", "Yes" if parsed.validation.balance_reconciled else "No"),
    ]
    summary_table = Table(summary_rows, colWidths=[60 * mm, 92 * mm])
    summary_table.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("Monthly Cash Flow", styles["Heading2"]))
    mcf_rows = [("Month", "Credits", "Debits", "Net")]
    for m in s.monthly_cash_flow:
        mcf_rows.append((m["month"], _fmt(m["credits"]), _fmt(m["debits"]), _fmt(m["net"])))
    mcf = Table(mcf_rows, colWidths=[40 * mm, 40 * mm, 40 * mm, 40 * mm])
    mcf.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1F4E79")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(mcf)
    story.append(Spacer(1, 6 * mm))

    if parsed.validation.all_issues:
        story.append(Paragraph("Validation Issues", styles["Heading2"]))
        issue_rows = [("Severity", "Type", "Message")]
        for issue in parsed.validation.all_issues[:20]:
            issue_rows.append((issue.severity, issue.issue_type, issue.message))
        issue_table = Table(issue_rows, colWidths=[22 * mm, 30 * mm, 100 * mm])
        issue_table.setStyle(TableStyle([
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(issue_table)

    doc.build(story)
    return bio.getvalue()


def _fmt(value) -> str:
    if value is None:
        return "—"
    if isinstance(value, float):
        return f"{value:,.2f}"
    return str(value)
