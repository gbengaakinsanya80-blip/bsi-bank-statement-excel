"""AI-style layout detection: rebuild lines from word geometry, locate the
table region and its column boundaries by studying the statement itself
instead of fixed coordinates."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from app.extraction.fields import looks_like_amount, looks_like_date
from app.extraction.pdf_reader import Line, Word

# Field keyword aliases, ordered most-specific first per field.
COLUMN_KEYWORDS: dict[str, list[str]] = {
    "value_date": ["value date", "val date", "value"],
    "date": ["date", "posting date", "trans date", "txn date", "transaction date"],
    "reference": ["reference", "ref no", "ref num", "ref number", "transaction reference"],
    "description": ["description", "narration", "details", "remarks", "transaction details"],
    "debit": ["debit", "withdrawal", "withdrawals", "pay out", "amount dr", "dr"],
    "credit": ["credit", "deposit", "deposits", "pay in", "amount cr", "cr"],
    "balance": ["running balance", "balance", "ledger balance", "bal"],
    "branch": ["branch"],
    "channel": ["channel", "teller"],
    "instrument": ["instrument", "cheque no", "cheque number", "cheque"],
    "currency": ["currency", "ccy"],
}

_HEADER_REQUIRED = {"date", "description", "balance"}
_HEADER_MIN_SCORE = 3


@dataclass
class Column:
    field: str
    x0: float
    x1: float


@dataclass
class Layout:
    """Detected table geometry for one statement."""

    page_width: float
    page_height: float
    header_line_no: int = -1
    header_page: int = -1
    columns: list[Column] = field(default_factory=list)
    table_top: float = 0.0
    table_bottom: float = 0.0
    column_source: str = "header"

    def column_for(self, field: str) -> Optional[Column]:
        for c in self.columns:
            if c.field == field:
                return c
        return None

    def assign(self, word: Word) -> Optional[str]:
        """Return the field name a word's x-centre belongs to, or None."""
        cx = word.center
        best: Optional[tuple[str, float]] = None
        for c in self.columns:
            if c.x0 <= cx <= c.x1:
                return c.field
            dist = min(abs(cx - c.x0), abs(cx - c.x1))
            if best is None or dist < best[1]:
                best = (c.field, dist)
        if best and best[1] < (self.page_width * 0.015):
            return best[0]
        return None

    @property
    def has_date(self) -> bool:
        return self.column_for("date") is not None


def cluster_into_lines(words: list[Word], top_tol: Optional[float] = None) -> list[list[Word]]:
    """Group words into visual lines using their top co-ordinates."""
    if not words:
        return []
    ws = sorted(words, key=lambda w: (w.top, w.x0))
    heights = [w.bottom - w.top for w in ws]
    median_h = sorted(heights)[len(heights) // 2] if heights else 10.0
    tol = top_tol if top_tol is not None else max(2.0, median_h * 0.45)

    groups: list[list[Word]] = []
    cur: list[Word] = []
    anchor: Optional[float] = None
    for w in ws:
        if cur is not None and anchor is not None and (w.top - anchor) > tol:
            groups.append(cur)
            cur = [w]
            anchor = w.top
        else:
            cur.append(w)
            if anchor is None or w.top < anchor:
                anchor = w.top
    if cur:
        groups.append(cur)
    return groups


def build_lines(words: list[Word], page_index: int, start_no: int = 0) -> list[Line]:
    lines: list[Line] = []
    no = start_no
    for group in cluster_into_lines(words):
        sorted_words = sorted(group, key=lambda w: w.x0)
        line = Line(
            top=min(w.top for w in sorted_words),
            bottom=max(w.bottom for w in sorted_words),
            x0=min(w.x0 for w in sorted_words),
            x1=max(w.x1 for w in sorted_words),
            text=" ".join(w.text for w in sorted_words),
            words=sorted_words,
            page_index=page_index,
            line_no=no,
        )
        lines.append(line)
        no += 1
    return lines


_NORMALIZE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    return _NORMALIZE.sub(" ", text.lower()).strip()


def _norm_words(words: list[str]) -> list[str]:
    return [_normalize(w.strip(".,:;")) for w in words]


def _words_contain_keyword(words: list[str], keyword: str) -> bool:
    """Match a keyword against word tokens. Handles multi-word keywords like
    ``value date`` (consecutive tokens) and loose prefixes like ``ref``."""
    tokens = keyword.split()
    if not tokens:
        return False
    if len(tokens) > 1:
        for i in range(len(words) - len(tokens) + 1):
            if all(words[i + j] == tokens[j] for j in range(len(tokens))):
                return True
        return False
    tok = tokens[0]
    for w in words:
        if w == tok:
            return True
    if len(tok) >= 3:
        for w in words:
            if w.startswith(tok) or tok.startswith(w):
                return True
    return False


def _keyword_on_line(line: Line, keyword: str) -> bool:
    return _words_contain_keyword(_norm_words([w.text for w in line.words]), keyword)


# ------------------------------------------------------------------ #
# Fast field matcher.
#
# The naive implementation re-scans every field's keyword list against the
# line's words (O(fields x keywords x words)). We invert it so one pass over
# the line's tokens covers every field at once:
#   * exact single-token keywords          -> dict lookup
#   * prefix keywords (both directions)    -> trie + prefix index
#   * multi-word keywords                  -> consecutive-token lookup
# Matching semantics are identical to _words_contain_keyword.
# ------------------------------------------------------------------ #

_SINGLE_EXACT: dict[str, str] = {}             # keyword token -> field
_SINGLE_PREFIX: dict[str, str] = {}            # keyword token (len>=3) -> field
_MULTI_FIRST: dict[str, list[tuple[tuple[str, ...], str]]] = {}
_PREFIX_INDEX: dict[str, list[str]] = {}       # line token w -> fields having w as prefix
_TRIE: dict[str, dict] = {}                    # keyword-prefix trie


def _build_matcher() -> None:
    for field, keywords in COLUMN_KEYWORDS.items():
        for kw in keywords:
            tokens = kw.split()
            if len(tokens) == 1:
                tok = tokens[0]
                _SINGLE_EXACT[tok] = field
                if len(tok) >= 3:
                    _SINGLE_PREFIX[tok] = field
            else:
                _MULTI_FIRST.setdefault(tokens[0], []).append((tuple(tokens[1:]), field))

    for tok, field in _SINGLE_PREFIX.items():
        for i in range(1, len(tok) + 1):
            _PREFIX_INDEX.setdefault(tok[:i], []).append(field)

    for tok, field in _SINGLE_PREFIX.items():
        node = _TRIE
        for ch in tok:
            node = node.setdefault(ch, {})
        node.setdefault("$", []).append(field)


_build_matcher()


def _match_fields(line: Line) -> set[str]:
    cached = getattr(line, "_field_cache", None)
    if cached is not None:
        return cached

    matched: set[str] = set()
    tokens = _norm_words([w.text for w in line.words])
    if not tokens:
        line._field_cache = matched
        return matched
    token_set = set(tokens)

    # Exact single-token keywords.
    for tok in token_set:
        field = _SINGLE_EXACT.get(tok)
        if field:
            matched.add(field)

    # Line token is a prefix of a keyword (keyword.startswith(word)).
    for tok in token_set:
        fields = _PREFIX_INDEX.get(tok)
        if fields:
            matched.update(fields)

    # Keyword is a prefix of a line token (word.startswith(keyword)) via trie.
    for tok in token_set:
        node = _TRIE
        for ch in tok:
            node = node.get(ch)
            if node is None:
                break
            ends = node.get("$")
            if ends:
                matched.update(ends)

    # Multi-word keywords: exact consecutive tokens.
    for i, tok in enumerate(tokens):
        entries = _MULTI_FIRST.get(tok)
        if not entries:
            continue
        for rest, field in entries:
            if tuple(tokens[i + 1: i + 1 + len(rest)]) == rest:
                matched.add(field)

    line._field_cache = matched
    return matched


def _find_keyword_word(words: list[Word], norm_words: list[str], keywords: list[str]):
    """Return the Word (or spanning box) for the first keyword found on a line."""
    best = None
    for kw in keywords:
        tokens = _normalize(kw).split()
        if not tokens:
            continue
        if len(tokens) > 1:
            for i in range(len(norm_words) - len(tokens) + 1):
                if all(norm_words[i + j] == tokens[j] for j in range(len(tokens))):
                    span = words[i:i + len(tokens)]
                    return _span_box(span)
            continue
        tok = tokens[0]
        for i, w in enumerate(norm_words):
            if w == tok or (len(tok) >= 3 and (w.startswith(tok) or tok.startswith(w))):
                return words[i]
    return best


def _span_box(ws: list[Word]) -> Word:
    if len(ws) == 1:
        return ws[0]
    return Word(
        x0=min(w.x0 for w in ws),
        top=min(w.top for w in ws),
        x1=max(w.x1 for w in ws),
        bottom=max(w.bottom for w in ws),
        text=" ".join(w.text for w in ws),
    )


def _merge_header_lines(lines: list[Line], best: Line) -> Line:
    """Merge adjacent header-label lines into one pseudo-line.

    Some OCR engines / printed statements put table labels on slightly
    different baselines (e.g. BALANCE or DATE one line below the rest of the
    header). Merging them lets every column anchor be found. Lines containing
    digits are never merged in (those are data rows).
    """
    merged = list(best.words)
    band_lo = best.top - 36.0
    band_hi = best.bottom + 36.0
    for other in lines:
        if other is best:
            continue
        if other.page_index != best.page_index:
            continue
        if other.bottom < band_lo or other.top > band_hi:
            continue
        if not _match_fields(other):
            continue
        if any(any(ch.isdigit() for ch in w.text) for w in other.words):
            continue
        merged.extend(other.words)
    if len(merged) == len(best.words):
        return best
    # Merge order is document order, which can differ from physical layout
    # (stacked header labels on adjacent baselines). Re-sort by x so the first
    # keyword match is the leftmost label (e.g. a two-line "TRANSACTION / DATE"
    # header where the real date column sits left of "VALUE DATE").
    merged.sort(key=lambda w: w.x0)
    return Line(
        top=min(w.top for w in merged),
        bottom=max(w.bottom for w in merged),
        x0=min(w.x0 for w in merged),
        x1=max(w.x1 for w in merged),
        text=" ".join(w.text for w in merged),
        words=merged,
        page_index=best.page_index,
        line_no=best.line_no,
    )


def detect_layout(
    lines: list[Line],
    page_width: float,
    page_height: float,
    header_candidates: Optional[list[Line]] = None,
) -> Layout:
    """Find the best header line and derive column boundaries."""
    layout = Layout(page_width=page_width, page_height=page_height)

    candidates = header_candidates if header_candidates is not None else lines[:40]
    best_line: Optional[Line] = None
    best_fields: set[str] = set()
    best_score = 0
    for line in candidates:
        fields = _match_fields(line)
        if not fields:
            continue
        score = len(fields)
        required_hits = len(fields & _HEADER_REQUIRED)
        # A header must reference the table's core columns.
        if required_hits == 0 and score < _HEADER_MIN_SCORE:
            continue
        if score > best_score or (score == best_score and required_hits > 0):
            best_score = score
            best_line = line
            best_fields = fields

    if best_line is None or best_score < _HEADER_MIN_SCORE:
        return _infer_layout(lines, page_width, page_height)

    # Some OCR engines / printed statements split header labels across two or
    # three adjacent baselines (e.g. DATE VALUE DATE DESCRIPTION DEBIT CREDIT
    # on one line and BALANCE on the next). Merge nearby header-label lines so
    # every column anchor is found.
    best_line = _merge_header_lines(lines, best_line)
    best_fields = _match_fields(best_line)

    layout.header_line_no = best_line.line_no
    layout.header_page = best_line.page_index
    layout.column_source = "header"

    bounds: dict[str, tuple[float, float]] = {}
    hw = [w.text for w in best_line.words]
    norm = _norm_words(hw)
    for field in ("value_date", "date", "reference", "description",
                  "debit", "credit", "balance", "branch", "channel", "instrument",
                  "currency"):
        if field not in best_fields:
            continue
        anchor = _find_keyword_word(best_line.words, norm, COLUMN_KEYWORDS[field])
        if anchor is not None:
            bounds[field] = (anchor.x0, anchor.x1)

    ordered = sorted(bounds.items(), key=lambda kv: kv[1][0])
    cols: list[Column] = []
    prev_x1 = 0.0
    for i, (field, (sx, ex)) in enumerate(ordered):
        # Column edges are anchored to the header label edges (labels are
        # narrower than their columns, so a midpoint rule would clip text).
        # The first column starts at the left page edge so tokens that begin
        # before the first label (dates typeset at the very left margin) still
        # fall inside it.
        x0 = 0.0 if i == 0 else prev_label_x1
        x1 = ordered[i + 1][1][0] if i + 1 < len(ordered) else page_width
        if x0 < prev_x1:
            x0 = prev_x1
        cols.append(Column(field=field, x0=x0, x1=x1))
        prev_x1 = x1
        prev_label_x1 = ex

    layout.columns = sorted(cols, key=lambda c: c.x0)
    layout.table_top = best_line.bottom if best_line else 0.0
    layout.table_bottom = page_height
    return layout


def _infer_layout(lines: list[Line], page_width: float, page_height: float) -> Layout:
    """Fallback: infer columns from content when no header line exists."""
    layout = Layout(page_width=page_width, page_height=page_height, column_source="inferred")
    amount_centers: list[float] = []
    date_centers: list[float] = []
    for line in lines:
        for w in line.words:
            if looks_like_amount(w.text):
                amount_centers.append(w.center)
            elif looks_like_date(w.text):
                date_centers.append(w.center)

    amount_groups = _cluster_x(amount_centers)
    cols: list[Column] = []
    if date_centers:
        dmin, dmax = min(date_centers) - 40, max(date_centers) + 40
        cols.append(Column(field="date", x0=0, x1=max(dmax, 0.16 * page_width)))

    n = len(amount_groups)
    if n >= 1:
        balance_group = amount_groups[-1]
        cols.append(Column(field="balance", x0=balance_group[0], x1=page_width))
        if n >= 2:
            cols.append(Column(field="credit", x0=amount_groups[-2][0], x1=balance_group[0]))
        if n >= 3:
            cols.append(Column(field="debit", x0=amount_groups[-3][0], x1=amount_groups[-2][0]))

    desc_start = cols[0].x1 if cols else 0.0
    desc_end = cols[-1].x0 if cols else page_width
    cols.append(Column(field="description", x0=desc_start, x1=desc_end))

    layout.columns = sorted(cols, key=lambda c: c.x0)
    layout.table_bottom = page_height
    return layout


def _cluster_x(centers: list[float], max_groups: int = 4) -> list[tuple[float, float]]:
    """1-D clustering of x-centres into contiguous bands via gap segmentation."""
    if not centers:
        return []
    centers = sorted(centers)
    if len(centers) == 1:
        return [(centers[0] - 1, centers[0] + 1)]
    gaps: list[tuple[float, int]] = []
    for i in range(1, len(centers)):
        gaps.append((centers[i] - centers[i - 1], i))
    gaps.sort(reverse=True)
    cut_points = sorted(i for _, i in gaps[: max_groups - 1])
    groups: list[tuple[float, float]] = []
    prev = 0
    for cut in cut_points:
        groups.append((centers[prev], centers[cut - 1]))
        prev = cut
    groups.append((centers[prev], centers[-1]))
    # merge tiny groups (likely stray tokens)
    merged: list[tuple[float, float]] = []
    for g in groups:
        if merged and (g[0] - merged[-1][1]) < (max(1.0, page_width_hint()) * 0.005):
            merged[-1] = (merged[-1][0], g[1])
        else:
            merged.append(g)
    return merged


def page_width_hint() -> float:
    return 595.0


def filter_noise_lines(lines: list[Line]) -> list[Line]:
    """Drop obvious header/footer/annotation lines that are not transactions."""
    out: list[Line] = []
    for line in lines:
        text = line.text.strip()
        if not text:
            continue
        if len(text) < 2:
            continue
        lower = text.lower()
        if _is_noise(lower):
            continue
        out.append(line)
    return out


_NOISE_RE = (
    re.compile(r"^\d{1,4}\s*/\s*\d{1,4}$"),                      # page x of y
    re.compile(r"^page\s*\d+.*", re.IGNORECASE),
    re.compile(r"statement of account|statement summary|summary of account", re.IGNORECASE),
    re.compile(r"^total\s+(amount|debit|debits|credit|credits|balance|bought|paid|received|withdrawn)\b", re.IGNORECASE),  # Zenith "TOTAL AMOUNT" closing rows
    re.compile(r"^(tel|address|customer care|email|website|www\.)", re.IGNORECASE),
    re.compile(r"^generated\s+on", re.IGNORECASE),
    re.compile(r"^print\s+date", re.IGNORECASE),
    re.compile(r"^\d{2}/\d{2}/\d{2,4}\s*-\s*\d{2}/\d{2}/\d{2,4}"),  # period line
    re.compile(r"^[a-z0-9@._-]{2,}\s*[:@]$"),                     # account/email label
)


def _is_noise(lower: str) -> bool:
    for pattern in _NOISE_RE:
        if pattern.search(lower):
            return True
    return False
