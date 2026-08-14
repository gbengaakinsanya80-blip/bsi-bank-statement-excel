"""Extraction engine: orchestrates PDF reading, OCR, layout detection, row
parsing, balance reconciliation, deduplication and summary/validation."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from datetime import date
from pathlib import Path
from typing import Callable, Optional

from app.core.config import DATA_DIR, OCR_DPI
from app.core.models import ParsedStatement, StatementMeta, Transaction
from app.extraction.bank_templates import detect_bank
from app.extraction.categorizer import categorize
from app.extraction.layout import build_lines, detect_layout, filter_noise_lines
from app.extraction.ocr import OCRBackend, get_all_backends
from app.extraction.pdf_reader import Page, PdfDocument, Word, read_pdf
from app.extraction.row_parser import parse_rows, to_transactions
from app.services.stats import compute_summary
from app.validation.checks import validate_statement

log = logging.getLogger(__name__)

ProgressCallback = Optional[Callable[[int, str], None]]

#: Max share of rows allowed to break the running-balance chain before the
#: engine re-runs OCR with the next (slower, more accurate) backend. Tunable
#: via BSI_BALANCE_ERROR_TOLERANCE so a deploy's gate can be adjusted without
#: a code change. 0.10 admits fast engines that still land most rows (residual
#: breaks are surfaced in the validation panel) while rejecting engines whose
#: output is so broken the running balance almost never lines up (e.g. the
#: Windows OCR pass at ~12% with exploded totals).
_BALANCE_ERROR_TOLERANCE = float(os.environ.get("BSI_BALANCE_ERROR_TOLERANCE", "0.10"))


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

        # Fastest-first OCR chain with an automatic accuracy gate: parse with
        # the preferred engine, verify against the running balance, and if too
        # many rows break the chain, re-OCR with the next engine. Per-engine
        # word caches make re-uploads of an already-seen file instant.
        result: Optional[ParsedStatement] = None
        backends = self._order_backends(doc) if ocr else []
        for backend in backends:
            cb(8, f"OCR engine: {backend.name}")
            ocr_done = self._run_ocr(doc, cb, backend)
            result = self._parse_document(doc, start, cb)
            error_rate = self._balance_error_rate(result.transactions)
            if ocr_done == 0 and result.transactions:
                # The engine produced no words for any page (skip/exception):
                # the empty parse must not pass the balance gate.
                error_rate = 1.0
            if error_rate <= _BALANCE_ERROR_TOLERANCE:
                break
            log.warning(
                "OCR engine '%s' failed balance validation (%.1f%% bad rows); "
                "retrying with the next engine.",
                backend.name,
                error_rate * 100,
            )
            self._reset_ocr_pages(doc)
        else:
            if result is None:
                result = self._parse_document(doc, start, cb)

        cb(95, "Finalising")
        return result

    # ------------------------------------------------------------------ #
    @staticmethod
    def _order_backends(doc: PdfDocument) -> list[OCRBackend]:
        """Order the OCR chain for a document.

        A previously-seen document whose words are already cached for an
        accurate engine is served from that cache first (instant + precise),
        so re-uploads keep the best result. Otherwise the fast engines run
        first and the slower accurate engines are tried only if the balance
        gate rejects them.
        """
        available = [b for b in get_all_backends() if b.available()]
        if not available:
            return []
        scanned = [p for p in doc.pages if p.image_path]
        if not scanned:
            return available
        cache_dir = DATA_DIR / "ocr_cache"
        cached_accurate: list[OCRBackend] = []
        fast: list[OCRBackend] = []
        uncached: list[OCRBackend] = []
        for backend in available:
            if backend.name not in ("windows", "tesseract"):
                cached = all(
                    ExtractionEngine._word_cache_path(cache_dir, p.image_path, backend.name).exists()
                    for p in scanned
                )
                if cached:
                    cached_accurate.append(backend)
                else:
                    uncached.append(backend)
            else:
                fast.append(backend)
        return cached_accurate + fast + uncached

    # ------------------------------------------------------------------ #
    def _parse_document(
        self, doc: PdfDocument, start: float, cb: ProgressCallback
    ) -> ParsedStatement:
        cb(45, "Building layout")
        raw_lines: list = []
        for page in doc.pages:
            if not page.words:
                continue
            raw_lines.extend(build_lines(page.words, page.index, start_no=len(raw_lines)))
        lines = filter_noise_lines(raw_lines)

        first = doc.pages[0]
        # Bank signatures often live on lines the noise filter drops (websites,
        # addresses), so detect from the raw line stream instead.
        header_text = "\n".join(l.text for l in raw_lines[:60])
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
        transactions = drop_page_boundary_garbage(transactions)
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

        return ParsedStatement(
            meta=meta,
            transactions=transactions,
            validation=report,
            summary=summary,
            columns_detected=columns_detected,
            raw_pages=[p.text for p in doc.pages[:5]] if layout.column_source == "inferred" else [],
        )

    # ------------------------------------------------------------------ #
    def _run_ocr(self, doc: PdfDocument, cb: ProgressCallback, backend: OCRBackend) -> int:
        needing = [p for p in doc.pages if p.needs_ocr]
        if not needing:
            return 0
        if not backend.available():
            log.warning("OCR backend '%s' is not available; skipping.", backend.name)
            return 0
        scale = 72.0 / OCR_DPI
        cache_dir = DATA_DIR / "ocr_cache"
        cache_dir.mkdir(parents=True, exist_ok=True)
        done = 0
        for i, page in enumerate(needing):
            cb(20 + int(20 * i / len(needing)), f"OCR page {page.index + 1}")
            try:
                words = self._cached_words(cache_dir, page.image_path, backend.name)
                if words is None:
                    result = backend.recognize_image(page.image_path)
                    words = list(result.words)
                    self._write_word_cache(cache_dir, page.image_path, backend.name, words)
                page.words = [
                    Word(
                        x0=w.x0 * scale,
                        top=w.top * scale,
                        x1=w.x1 * scale,
                        bottom=w.bottom * scale,
                        text=w.text,
                        confidence=w.confidence,
                    )
                    for w in words
                ]
                page.text = " ".join(w.text for w in page.words)
                page.needs_ocr = False
                done += 1
            except Exception as exc:  # pragma: no cover - env dependent
                log.warning("OCR failed on page %d: %s", page.index + 1, exc)
        return done

    def _reset_ocr_pages(self, doc: PdfDocument) -> None:
        """Undo OCR so a different backend can run on the same pages."""
        for page in doc.pages:
            if page.image_path:
                page.words = []
                page.text = ""
                page.needs_ocr = True

    @staticmethod
    def _balance_error_rate(transactions: list[Transaction]) -> float:
        """Fraction of rows whose amount breaks the running balance chain.

        Uses each row's own balance as the anchor, so a single bad row does
        not cascade into false positives for every later row.
        """
        with_balance = 0
        errors = 0
        prev: Optional[float] = None
        for t in transactions:
            if t.is_beginning_balance or t.is_ending_balance:
                continue
            if t.balance is None:
                prev = None
                continue
            if prev is None:
                prev = t.balance
                continue
            delta = round(t.balance - prev, 2)
            amount = abs(t.credit or 0.0) + abs(t.debit or 0.0)
            if abs(abs(delta) - amount) > 0.01 and abs(delta) > 0.01:
                errors += 1
            prev = t.balance
            with_balance += 1
        if not with_balance:
            return 0.0
        return errors / with_balance

    @staticmethod
    def _word_cache_path(cache_dir: Path, image_path: str, engine: str) -> Path:
        image_hash = sha256_file(image_path)[:16]
        return cache_dir / f"words_{image_hash}_{engine}.json"

    def _cached_words(self, cache_dir: Path, image_path: str, engine: str) -> Optional[list[Word]]:
        """Return previously-OCR'd words for a page image, or None on a miss.

        Coordinates are stored in image pixels, so the cache is only valid for
        the exact rasterisation (same file content + DPI)."""
        cache_file = self._word_cache_path(cache_dir, image_path, engine)
        if not cache_file.exists():
            return None
        try:
            data = json.loads(cache_file.read_text(encoding="utf-8"))
            return [
                Word(
                    x0=w["x0"], top=w["top"], x1=w["x1"], bottom=w["bottom"],
                    text=w["text"], confidence=w["confidence"],
                )
                for w in data.get("words", [])
            ]
        except Exception:  # noqa: BLE001 - corrupt cache is a miss
            return None

    @staticmethod
    def _write_word_cache(cache_dir: Path, image_path: str, engine: str, words: list[Word]) -> None:
        cache_file = ExtractionEngine._word_cache_path(cache_dir, image_path, engine)
        try:
            payload = {
                "engine": engine,
                "dpi": OCR_DPI,
                "image_hash": sha256_file(image_path)[:16],
                "words": [
                    {"x0": w.x0, "top": w.top, "x1": w.x1, "bottom": w.bottom,
                     "text": w.text, "confidence": w.confidence}
                    for w in words
                ],
            }
            tmp = cache_file.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload), encoding="utf-8")
            tmp.replace(cache_file)
        except Exception:  # noqa: BLE001 - caching is best-effort
            pass

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
        if t.is_ending_balance:
            continue
        if t.balance is None:
            if prev is not None and (t.credit is not None or t.debit is not None):
                prev = prev + (t.credit or 0.0) - (t.debit or 0.0)
            continue

        delta = round(t.balance - (prev or 0.0), 2)
        has_debit = t.debit is not None
        has_credit = t.credit is not None

        if has_debit and has_credit:
            # Both columns filled (a duplicated amount): keep only the one that
            # agrees with the observed balance movement.
            if delta < 0:
                t.credit = None
            elif delta > 0:
                t.debit = None
            has_debit = t.debit is not None
            has_credit = t.credit is not None

        if has_debit or has_credit:
            # Which amount matches the observed delta, sign included?
            if has_credit and abs(t.credit) == abs(delta):
                if delta < 0:
                    t.debit = abs(t.credit)
                    t.credit = None
                else:
                    t.credit = abs(delta)
            elif has_debit and abs(t.debit) == abs(delta):
                if delta > 0:
                    t.credit = abs(t.debit)
                    t.debit = None
                else:
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
            # No amount extracted: infer it from the balance movement.
            if delta < 0:
                t.debit = abs(delta)
            elif delta > 0:
                t.credit = delta

        prev = t.balance
    return transactions


def _is_unreadable_description(text: str) -> bool:
    """Heuristic for a description whose words are fragmented/meaningless.

    Real statement lines carry at least one token of 4+ characters (account
    names, bank codes, narrative words). A line made only of 1-3 character
    fragments is the signature of a corrupted PDF text layer.
    """
    tokens = [t for t in text.split() if any(c.isalnum() for c in t)]
    if len(tokens) < 2:
        return False
    return max(sum(1 for c in t if c.isalnum()) for t in tokens) < 4


def drop_page_boundary_garbage(transactions: list[Transaction]) -> list[Transaction]:
    """Drop a corrupted page-boundary repeat row.

    Some layouts reprint the last table row at the top of the next page. When
    that reprint's text layer is corrupted (fragmented glyphs, broken amounts),
    its own parsed amount can still look self-consistent against its broken
    balance, fooling reconciliation. Such a row is dropped only when it is the
    first row of a new page, its description is unreadable, and removing it
    keeps the running-balance chain intact (the following row's balance is
    reachable from the previous page's closing balance via that row's amount
    magnitude). The following row's debit/credit direction is repaired against
    the reconnected chain, since reconciliation may have seen it from the
    corrupted intermediate balance.
    """
    out: list[Transaction] = []
    for i, t in enumerate(transactions):
        if t.is_beginning_balance or t.is_ending_balance:
            out.append(t)
            continue
        prev_kept = out[-1] if out else None
        if (
            prev_kept is None
            or prev_kept.balance is None
            or t.page_number <= prev_kept.page_number
            or not _is_unreadable_description(t.description or "")
        ):
            out.append(t)
            continue
        nxt = None
        for j in range(i + 1, len(transactions)):
            if transactions[j].is_beginning_balance or transactions[j].is_ending_balance:
                continue
            nxt = transactions[j]
            break
        if nxt is None or nxt.balance is None:
            out.append(t)
            continue
        delta = nxt.balance - prev_kept.balance
        amount = (nxt.debit or 0.0) if (nxt.debit or 0.0) > 0 else (nxt.credit or 0.0)
        if abs(abs(delta) - amount) >= 0.01:
            out.append(t)
            continue
        # The row is a no-op on the balance chain: drop the corrupt repeat and
        # repair the following row's direction against the reconnected chain.
        if abs(delta) >= 0.005:
            if delta < 0:
                nxt.debit = abs(delta)
                nxt.credit = None
            else:
                nxt.credit = abs(delta)
                nxt.debit = None
        continue
    return out


def dedupe_transactions(transactions: list[Transaction]) -> list[Transaction]:
    """Remove repeated page-boundary rows without touching legitimate repeats.

    Repeated per-page opening/closing balance rows (same flag + balance) are
    collapsed to a single row. A transaction that leaves the running balance
    unchanged (its balance equals the previous kept row's) is dropped: layouts
    reprint the last table row at the top of the following page, and the
    reprint carries the same balance. Genuine transactions whose balance merely
    returns to an earlier value are kept -- only balance equality with the
    immediately preceding row triggers a drop, and a reprint's description is
    usually unreadable (it was a copy with corrupt glyphs) while a legit
    zero-net row carries real narrative.
    """
    seen: set[str] = set()
    out: list[Transaction] = []
    prev_balance: Optional[float] = None
    for t in transactions:
        if t.is_beginning_balance or t.is_ending_balance:
            key = (
                f"flag:{int(t.is_beginning_balance)}:{int(t.is_ending_balance)}:"
                f"{t.balance or 0.0:.2f}"
            )
            if key in seen:
                continue
            seen.add(key)
            out.append(t)
            continue
        if (
            prev_balance is not None
            and t.balance is not None
            and abs(t.balance - prev_balance) < 0.005
            and (t.fingerprint() in seen or _is_unreadable_description(t.description or ""))
        ):
            continue
        seen.add(t.fingerprint())
        out.append(t)
        if t.balance is not None:
            prev_balance = t.balance
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

    # Numeric ranges: "Period: 01/01/2025 - 31/12/2025".
    m = re.search(
        r"(?i)(?:period|from)\s*[.:]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*"
        r"(?:-|to|till|until|and)\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        text,
    )
    if m:
        return (parse_date(m.group(1)), parse_date(m.group(2)))
    # Named-month ranges: "January 1, 2025 through July 18, 2025".
    m = re.search(
        r"(?i)((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)\s+(\d{1,2}),?\s+(\d{2,4})\s*"
        r"(?:-|to|till|until|and|through)\s*"
        r"((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)\s+(\d{1,2}),?\s+(\d{2,4})",
        text,
    )
    if m:
        start = parse_date(f"{m.group(2)} {m.group(1)} {m.group(3)}")
        end = parse_date(f"{m.group(5)} {m.group(4)} {m.group(6)}")
        return (start, end)
    return (None, None)


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            h.update(chunk)
    return h.hexdigest()
