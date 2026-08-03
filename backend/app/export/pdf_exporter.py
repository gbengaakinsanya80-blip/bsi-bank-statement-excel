"""PDF summary exporter (reportlab)."""

from __future__ import annotations

import io

from ..core.models import ParsedStatement

try:  # pragma: no cover - optional
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    HAS_REPORTLAB = True
except Exception:  # noqa: BLE001
    HAS_REPORTLAB = False


def export_pdf_summary(parsed: ParsedStatement) -> bytes:
    if not HAS_REPORTLAB:
        raise RuntimeError("reportlab is required for PDF summary export.")
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )
    styles = getSampleStyleSheet()
    title = ParagraphStyle("Title", parent=styles["Title"], textColor=colors.HexColor("#1F4E79"))
    h2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=colors.HexColor("#1F4E79"))
    small = ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8)

    story: list = []
    story.append(Paragraph(f"Bank Statement Summary — {parsed.meta.bank_name or 'Unknown Bank'}", title))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"File: {parsed.meta.file_name}", styles["Normal"]))
    story.append(Spacer(1, 8))

    story.append(Paragraph("Account Information", h2))
    meta_rows = [
        ["Account Name", parsed.meta.account_name],
        ["Account Number", parsed.meta.account_number],
        ["Currency", parsed.meta.currency],
        ["Period", f"{parsed.meta.period_start or ''} to {parsed.meta.period_end or ''}"],
        ["Pages Processed", str(parsed.meta.total_pages_processed)],
        ["Extraction Method", f"{parsed.meta.extraction_method}{' (OCR)' if parsed.meta.ocr_used else ''}"],
    ]
    t = Table(meta_rows, colWidths=[60 * mm, 150 * mm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.25, colors.grey), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold")]))
    story.append(t)
    story.append(Spacer(1, 10))

    s = parsed.summary
    story.append(Paragraph("Financial Summary", h2))
    summary_rows = [
        ["Opening Balance", s.opening_balance],
        ["Closing Balance", s.closing_balance],
        ["Total Credits", s.total_credits],
        ["Total Debits", s.total_debits],
        ["Number of Transactions", s.number_of_transactions],
        ["Largest Debit", s.largest_debit],
        ["Largest Credit", s.largest_credit],
        ["Average Debit", s.average_debit],
        ["Average Credit", s.average_credit],
    ]
    t = Table([[k, (f"{v:,.2f}" if isinstance(v, (int, float)) else v)] for k, v in summary_rows], colWidths=[60 * mm, 150 * mm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.25, colors.grey), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold")]))
    story.append(t)
    story.append(Spacer(1, 10))

    story.append(Paragraph("Validation Report", h2))
    v = parsed.validation
    validation_rows = [
        ["Balance Reconciled", "Yes" if v.balance_reconciled else "No"],
        ["OCR Confidence", f"{v.ocr_confidence:.1%}" if v.ocr_confidence is not None else "n/a"],
        ["Missing Rows", len(v.missing_rows)],
        ["Balance Errors", len(v.balance_errors)],
        ["Duplicate Entries", len(v.duplicate_entries)],
        ["Unreadable Transactions", len(v.unreadable_transactions)],
    ]
    t = Table(validation_rows, colWidths=[60 * mm, 150 * mm])
    t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.25, colors.grey), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold")]))
    story.append(t)
    story.append(Spacer(1, 10))

    if v.balance_errors:
        story.append(Paragraph("Balance Errors (detail)", h2))
        rows = [["Page", "Line", "Message"]]
        for issue in v.balance_errors[:20]:
            rows.append([str(issue.page_number or ""), str(issue.line_number or ""), issue.message])
        t = Table(rows, colWidths=[20 * mm, 20 * mm, 170 * mm])
        t.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.25, colors.grey)]))
        story.append(t)

    doc.build(story)
    return buf.getvalue()
