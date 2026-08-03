"""AI-style layout detection.

Instead of relying on fixed coordinates, the detector studies each page:

- finds the column header row by scanning for known keywords
- derives column x-boundaries from header word positions
- detects multi-column (side-by-side) layouts by clustering header groups
- records detected fonts/sizes to help decide row grouping
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional

from .banks import get_template
from .pdf_reader import PageData, Word


@dataclass
class ColumnDef:
    key: str
    label: str
    x0: float
    x1: float
    order: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {"key": self.key, "label": self.label, "x0": self.x0, "x1": self.x1, "order": self.order}


@dataclass
class Layout:
    bank_name: str
    column_defs: list[ColumnDef]
    header_line: Optional[str] = None
    multi_column: bool = False
    page_width: float = 0.0
    confidence: float = 0.0

    def columns(self) -> list[str]:
        return [c.key for c in sorted(self.column_defs, key=lambda c: c.order)]

    def to_dict(self) -> dict[str, Any]:
        return {
            "bank_name": self.bank_name,
            "columns": self.columns(),
            "column_defs": [c.to_dict() for c in sorted(self.column_defs, key=lambda c: c.order)],
            "header_line": self.header_line,
            "multi_column": self.multi_column,
            "page_width": self.page_width,
            "confidence": self.confidence,
        }


# Canonical header labels -> column key
LABEL_MAP: list[tuple[str, str]] = [
    ("value date", "value_date"),
    ("transaction date", "date"),
    ("tran date", "date"),
    ("posting date", "date"),
    ("value", "value_date"),
    ("date", "date"),
    ("description", "description"),
    ("narration", "description"),
    ("particulars", "description"),
    ("details", "description"),
    ("remarks", "description"),
    ("transaction details", "description"),
    ("transactions", "description"),
    ("reference", "reference"),
    ("reference number", "reference"),
    ("ref no", "reference"),
    ("ref", "reference"),
    ("txn ref", "reference"),
    ("transaction reference", "reference"),
    ("withdrawal", "debit"),
    ("withdrawals", "debit"),
    ("debit amount", "debit"),
    ("debits", "debit"),
    ("debit", "debit"),
    ("pay out", "debit"),
    ("amount", "debit"),
    ("amount (dr)", "debit"),
    ("dr", "debit"),
    ("deposit", "credit"),
    ("deposits", "credit"),
    ("credit amount", "credit"),
    ("credits", "credit"),
    ("credit", "credit"),
    ("pay in", "credit"),
    ("amount (cr)", "credit"),
    ("cr", "credit"),
    ("balance", "balance"),
    ("running balance", "balance"),
    ("balance (ngn)", "balance"),
    ("account balance", "balance"),
    ("available balance", "balance"),
    ("instrument", "instrument_number"),
    ("branch", "branch"),
    ("channel", "channel"),
    ("transaction type", "tx_type"),
    ("type", "tx_type"),
]

_HEADER_SCOPE_KEYWORDS = [
    "transaction", "statement", "date", "description", "debit", "credit",
    "balance", "reference", "withdrawal", "deposit", "narration", "amount",
]


def _canonical_key(label: str) -> Optional[str]:
    norm = " ".join(label.lower().split())
    norm = norm.rstrip(":").strip()
    if not norm:
        return None
    for raw, key in LABEL_MAP:
        if raw in norm:
            return key
    if any(kw in norm for kw in _HEADER_SCOPE_KEYWORDS):
        return None
    return None


GAP_THRESHOLD = 24.0


def _segment_header_line(line: list[Word]) -> dict[str, tuple[list[Word], str]]:
    """Segment a header line into column groups using horizontal gaps, then
    classify each group's joined text into a canonical column key.

    Words belonging to the same column (e.g. "Value Date", "Debit (NGN)")
    stay together; separate columns are split on large x-gaps.
    """
    words = sorted(line, key=lambda w: w.x0)
    segments: list[list[Word]] = []
    for w in words:
        if segments and (w.x0 - segments[-1][-1].x1) < GAP_THRESHOLD:
            segments[-1].append(w)
        else:
            segments.append([w])

    out: dict[str, tuple[list[Word], str]] = {}
    for seg in segments:
        text = " ".join(x.text for x in seg)
        key = _canonical_key(text)
        if key and key not in out:
            out[key] = (seg, text)
    return out


def detect_layout(
    pages: list[PageData],
    bank_name: str = "generic",
) -> Layout:
    """Detect the column layout from the given pages."""
    if not pages:
        return Layout(bank_name=bank_name, column_defs=[], confidence=0.0)

    best_columns: dict[str, ColumnDef] = {}
    best_confidence = 0.0
    header_line_text: Optional[str] = None
    multi_column = False
    page_width = max((p.width for p in pages if p.width), default=0.0)

    for page in pages[:3]:
        cols, conf, hdr, multi = _detect_page(page, bank_name)
        if conf > best_confidence:
            best_confidence = conf
            if cols:
                best_columns = cols
            header_line_text = hdr
            multi_column = multi
            page_width = page.width

    column_defs = sorted(best_columns.values(), key=lambda c: c.order)
    # Re-order based on template column order as a tie-break.
    tpl = get_template(bank_name)
    order_map = {k: i for i, k in enumerate(tpl.column_order)}
    column_defs.sort(key=lambda c: (order_map.get(c.key, 99), c.x0))
    for i, c in enumerate(column_defs):
        c.order = i

    return Layout(
        bank_name=bank_name,
        column_defs=column_defs,
        header_line=header_line_text,
        multi_column=multi_column,
        page_width=page_width,
        confidence=best_confidence,
    )


def _detect_page(page: PageData, bank_name: str) -> tuple[dict[str, ColumnDef], float, Optional[str], bool]:
    tpl = get_template(bank_name)
    words = page.words
    if not words:
        return {}, 0.0, None, False

    # Group words into lines using vertical proximity.
    lines: list[list[Word]] = []
    for w in sorted(words, key=lambda x: (x.top, x.x0)):
        placed = False
        for line in lines:
            if line and abs(w.top - line[0].top) < max(4, 0.6 * (line[0].bottom - line[0].top)):
                line.append(w)
                placed = True
                break
        if not placed:
            lines.append([w])
    for line in lines:
        line.sort(key=lambda x: x.x0)

    # Find candidate header lines: contain >=2 mapped column labels.
    candidates: list[tuple[list[Word], dict[str, ColumnDef], float]] = []
    for line in lines:
        matches = _segment_header_line(line)
        if len(matches) >= 2:
            cols: dict[str, ColumnDef] = {}
            for key, (ws, label) in matches.items():
                xs = [w.x0 for w in ws]
                xe = [w.x1 for w in ws]
                cols[key] = ColumnDef(
                    key=key,
                    label=label,
                    x0=min(xs),
                    x1=max(xe),
                    order=len(cols),
                )
            # Confidence: match against template keywords + number of columns.
            conf = _header_confidence(line, matches, tpl)
            candidates.append((line, cols, conf))

    if not candidates:
        # Fall back: locate a single 'DATE' / 'TRANSACTION DATE' style header.
        return {}, 0.0, None, False

    line, cols, conf = max(candidates, key=lambda c: c[2])
    header_text = " ".join(w.text for w in line)

    # Multi-column detection: if the header line has two separated groups of
    # columns with a wide gap, treat as side-by-side statement.
    xs = sorted((w.x0 for w in line))
    if len(xs) >= 2:
        gaps = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
        if gaps and max(gaps) > 100 and page.width > 0:
            multi_column = max(gaps) > 0.25 * page.width
        else:
            multi_column = False
    else:
        multi_column = False

    # Derive boundaries between the detected column CENTRES (headers are
    # centred in their cells, so centres are more reliable than label edges).
    centers = sorted([((c.x0 + c.x1) / 2.0, c.key) for c in cols.values()])
    for i, (cx, key) in enumerate(centers):
        if i == 0:
            lo = 0.0
        else:
            lo = (centers[i - 1][0] + cx) / 2.0
        if i == len(centers) - 1:
            hi = page.width or (cx * 1.1)
        else:
            hi = (cx + centers[i + 1][0]) / 2.0
        cols[key].x0 = lo
        cols[key].x1 = hi

    return cols, conf, header_text, multi_column


def _header_confidence(line: list[Word], matches: dict[str, tuple[list[Word], str]], tpl) -> float:
    score = 0.0
    for key in matches:
        if key in tpl.column_order:
            score += 1.0
    text = " ".join(w.text for w in line).lower()
    for kw in tpl.keywords:
        if kw and kw in text:
            score += 0.5
    n = max(len(matches), 1)
    return score / n
