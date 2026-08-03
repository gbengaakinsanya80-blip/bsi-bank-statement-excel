"""Extraction engine: orchestrates PDF reading, OCR, layout detection, row
parsing, balance reconciliation, deduplication and summary/validation."""

from __future__ import annotations

import hashlib
import logging
import re
import time
from datetime import date
from pathlib import Path
from typing import Callable, Optional

from app.core.config import OCR_DPI
from app.core.models import ParsedStatement, StatementMeta, Transaction
from app.extraction.bank_templates import detect_bank
from app.extraction.categorizer import categorize
from app.extraction.layout import build_lines, detect_layout, filter_noise_lines
from app.extraction.ocr import get_available_backend
from app.extraction.pdf_reader import Page, PdfDocument, Word, read_pdf
from app.extraction.row_parser import parse_rows, to_transactions
from app.services.stats import compute_summary
from app.validation.checks import validate_statement

log = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[int, str], None]]


class ExtractionEngine:
    """Stateless engine; safe to call from multiple worker threads."""

    def process(
        self,
        path: str,
        progress_cb: ProgressCallback = None,
        ocr: bool = True,
    ) -> ParsedStatement:
        start = time.perf_counter()
        cb = progress_cb or (lambda p, m: None)

        cb(3, "Opening PDF")
        doc = read_pdf(path, progress_cb=cb)
        if not doc.pages:
            raise ValueError("The PDF contains no readable pages.")

        if ocr:
            self._run_ocr(doc, cb)

        cb(45, "Building layout")
        lines = self._build_lines(doc)

        first = doc.pages[0]
        header_text = "\n".join(l.text for l in lines[:40])
        template, bank_confidence = detect_bank(header_text)
        layout = detect_layout(lines, first.width, first.height)

        cb(60, f"Detected {template.name}; parsing rows")
        records = parse_rows(
            lines,
            layout,
            template,
            header_line_no=layout.header_line_no,
        )
        transactions = to_transactions(records, template)
        for tx in transactions:
            tx.category = categorize(tx.description)

        cb(72, "Reconciling balances")
        transactions = reconcile_transactions(transactions)
        transactions = dedupe_transactions(transactions)

        meta = self._build_meta(doc, template.name, bank_confidence, start)
        summary = compute_summary(transactions, currency=meta.currency)
        report = validate_statement(
            transactions, summary, ocr_confidence=self._ocr_confidence(doc)
        )

        columns_detected = {
            "source": layout.column_source,
            "columns": [{"field": c.field, "x0": round(c.x0, 1), "x1": round(c.x1, 1)} for c in layout.columns],
            "header_page": layout.header_page + 1 if layout.header_page >= 0 else None,
        }

        cb(95, "Finalising")
        result = ParsedStatement(
            meta=meta,
            transactions=transactions,
            validation=report,
            summary=summary,
            columns_detected=columns_detected,
            raw_pages=[p.text for p in doc.pages[:5]] if layout.column_source == "inferred" else [],
        )
        cb(100, "Done")
        return result

    # ------------------------------------------------------------------ #
    def _run_ocr(self, doc: PdfDocument, cb: ProgressCallback) -> None:
        needing = [p for p in doc.pages if p.needs_ocr]
        if not needing:
            return
        backend = get_available_backend()
        if backend is None:
            log.warning(
                "%d page(s) look scanned but no OCR backend is installed. "
                "Install pytesseract+tesseract or paddleocr to read them.",
                len(needing),
            )
            return
        scale = 72.0 / OCR_DPI
        for i, page in enumerate(needing):
            cb(20 + int(20 * i / len(needing)), f"OCR page {page.index + 1}")
            try:
                result = backend.recognize_image(page.image_path)
                page.words = [
                    Word(
                        x0=w.x0 * scale,
                        top=w.top * scale,
                        x1=w.x1 * scale,
                        bottom=w.bottom * scale,
                        text=w.text,
                        confidence=w.confidence,
                    )
                    for w in result.words
                ]
                page.text = " ".join(w.text for w in page.words)
                page.needs_ocr = False
            except Exception as exc:  # pragma: no cover - env dependent
                log.warning("OCR failed on page %d: %s", page.index + 1, exc)

    def _build_lines(self, doc: PdfDocument):
        lines = []
        for page in doc.pages:
            if not page.words:
                continue
            lines.extend(build_lines(page.words, page.index, start_no=len(lines)))
        return filter_noise_lines(lines)

    def _build_meta(
        self,
        doc: PdfDocument,
        bank_name: str,
        bank_confidence: float,
        start: float,
    ) -> StatementMeta:
        full_text = "\n".join(p.text for p in doc.pages)
        ocr_pages = [p for p in doc.pages if p.image_path]
        text_pages = [p for p in doc.pages if not p.image_path and p.words]
        if ocr_pages and text_pages:
            method = "hybrid"
        elif ocr_pages:
            method = "ocr"
        else:
            method = "text"
        period_start, period_end = extract_period(full_text)
        return StatementMeta(
            file_name=Path(doc.file_path).name,
            bank_name=bank_name,
            account_name=extract_account_name(full_text),
            account_number=extract_account_number(full_text),
            currency=extract_currency(full_text),
            period_start=period_start,
            period_end=period_end,
            page_count=len(doc.pages),
            extraction_method=method,
            ocr_used=bool(ocr_pages),
            total_pages_processed=len(doc.pages),
            parse_time_seconds=round(time.perf_counter() - start, 2),
            source_file_hash=sha256_file(doc.file_path),
            bank_confidence=round(bank_confidence, 3),
        )

    def _ocr_confidence(self, doc: PdfDocument) -> Optional[float]:
        confs = [w.confidence for p in doc.pages for w in p.words]
        if not confs:
            return None
        return round(sum(confs) / len(confs), 3)


# ------------------------------------------------------------------------- #
# Reconciliation & deduplication helpers                                     #
# ------------------------------------------------------------------------- #
def reconcile_transactions(transactions: list[Transaction]) -> list[Transaction]:
    """Correct debit/credit column swaps and infer missing amounts from the
    running balance, so amounts are consistent with the balance column."""
    prev: Optional[float] = None
    for t in transactions:
        if t.is_beginning_balance:
            prev = t.balance
            continue
        if t.balance is None:
            if prev is not None and (t.credit is not None or t.debit is not None):
                prev = prev + (t.credit or 0.0) - (t.debit or 0.0)
            continue

        delta = round(t.balance - (prev or 0.0), 2)
        has_debit = t.debit is not None
        has_credit = t.credit is not None

        if has_debit or has_credit:
            # Which amount matches the observed delta (ignoring sign)?
            if has_credit and abs(t.credit) == abs(delta):
                t.credit = abs(delta)
            elif has_debit and abs(t.debit) == abs(delta):
                t.debit = abs(delta)
            elif has_debit and not has_credit:
                # Amount present but sign disagrees -> it belongs in the other column.
                if delta > 0:
                    t.credit = t.debit
                    t.debit = None
                elif delta == 0:
                    pass
            elif has_credit and not has_debit:
                if delta < 0:
                    t.debit = t.credit
                    t.credit = None
            else:
                # Both set: trust the one that matches the sign of delta.
                if delta < 0 and t.debit is not None:
                    t.credit = None
                elif delta > 0 and t.credit is not None:
                    t.debit = None
        else:
            # No amount extracted: infer it from the balance movement.
            if delta < 0:
                t.debit = abs(delta)
            elif delta > 0:
                t.credit = delta

        prev = t.balance
    return transactions


def dedupe_transactions(transactions: list[Transaction]) -> list[Transaction]:
    """Remove exact duplicate records (same fingerprint), keeping the first."""
    seen: set[str] = set()
    out: list[Transaction] = []
    for t in transactions:
        if t.is_beginning_balance or t.is_ending_balance:
            out.append(t)
            continue
        fp = t.fingerprint()
        if fp in seen:
            continue
        seen.add(fp)
        out.append(t)
    return out


# ------------------------------------------------------------------------- #
# Metadata extraction helpers                                                #
# ------------------------------------------------------------------------- #
def extract_account_name(text: str) -> str:
    m = re.search(r"(?i)account\s*name\s*[:.#]?\s*([A-Za-z][A-Za-z0-9 .'-]{2,60})", text)
    return m.group(1).strip() if m else ""


def extract_account_number(text: str) -> str:
    m = re.search(
        r"(?i)account\s*(?:no\.?|number)?\s*[:.#]?\s*(\d{10})", text
    )
    if m:
        return m.group(1)
    m = re.search(r"(?i)acct\s*[:.#]?\s*(\d{10})", text)
    return m.group(1) if m else ""


def extract_currency(text: str) -> str:
    if re.search(r"NGN|\u20a6|Nigerian Naira", text, re.IGNORECASE):
        return "NGN"
    if re.search(r"USD|\$", text):
        return "USD"
    return "NGN"


def extract_period(text: str) -> tuple[Optional[date], Optional[date]]:
    from app.extraction.fields import parse_date

    m = re.search(
        r"(?i)(?:period|from)\s*[.:]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*"
        r"(?:-|to|till|until|and)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        text,
    )
    if m:
        return (parse_date(m.group(1)), parse_date(m.group(2)))
    return (None, None)


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()
