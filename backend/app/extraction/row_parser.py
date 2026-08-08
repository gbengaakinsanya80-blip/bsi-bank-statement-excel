"""Row segmentation and multi-line transaction merging.

A transaction starts when a line carries a date (in the detected date
columns) — or, for layouts with no date column, when it carries both an
amount and a running balance. Continuation lines (no date) are merged into
the open transaction, joining descriptions and filling any missing amounts.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from app.core.models import Transaction
from app.extraction.bank_templates import (
    BankTemplate,
    label_is_brought_forward,
    label_is_carried_forward,
    label_is_closing,
    label_is_opening,
)
from app.extraction.description import clean_description, extract_reference, join_parts
from app.extraction.fields import (
    is_exact_date,
    looks_like_amount,
    looks_like_date,
    parse_amount,
    parse_signed_amount,
)
from app.extraction.layout import Layout
from app.extraction.pdf_reader import Line


@dataclass
class _RawRecord:
    date_tokens: list[str] = field(default_factory=list)
    value_date_tokens: list[str] = field(default_factory=list)
    desc_parts: list[str] = field(default_factory=list)
    reference: str = ""
    debit: Optional[float] = None
    credit: Optional[float] = None
    balance: Optional[float] = None
    is_opening: bool = False
    is_closing: bool = False
    page: int = 1
    line_no: int = 0

    def has_content(self) -> bool:
        return bool(
            self.is_opening
            or self.is_closing
            or self.debit is not None
            or self.credit is not None
            or self.balance is not None
            or self.date_tokens
            or self.desc_parts
            or self.reference
        )


# Words that only ever appear on table headers / sub-headers. A line made
# entirely of these (plus column keywords) with no digits is a header, not a
# transaction row.
_HEADER_ONLY_WORDS = {
    "posted", "posting", "transaction", "running", "value", "val", "date",
    "debit", "credit", "balance", "description", "narration", "reference",
    "details", "remarks", "withdrawal", "deposit", "branch", "channel",
    "instrument", "currency", "details", "post", "txn",
}

# Labels that appear in per-page summary blocks above the table (never in
# transaction rows). Only consulted for lines above a page's table header.
_SUMMARY_LABEL_RE = re.compile(
    r"(account\s*number|acct\.?\s*no\.?|currency|"
    r"total\s+(debit|credit|amount)|period|statement\s+period)\b",
    re.IGNORECASE,
)

# Footer disclaimers printed below the table. A line that matches one of these
# and carries no amounts/balance is prose, not a transaction.
_FOOTER_PROSE_RE = re.compile(
    r"(please\s*examine\s*this\s*statement|verify\s*all\s*entries|"
    r"system.{0,3}generated|this\s*is\s*a\s*(computer|system)|"
    r"do\s*not\s*honour|account\s*statement\s*is\s*issued|"
    r"total\s+debit|total\s+credit|closing\s+balance)",
    re.IGNORECASE,
)


def parse_rows(
    lines: list[Line],
    layout: Layout,
    template: BankTemplate,
    header_line_no: int = -1,
) -> list[_RawRecord]:
    records: list[_RawRecord] = []
    cur: Optional[_RawRecord] = None
    single_amount_col = not _has_separate_columns(layout)

    page_headers = _detect_page_headers(lines, header_line_no)
    header_opening: Optional[_RawRecord] = None
    header_closing: Optional[_RawRecord] = None

    for line in lines:
        if _is_header_line(line) or _is_sub_header_line(line):
            continue

        # Lines above a page's table header are the banner / per-page summary
        # block. They are never transactions; only the first opening/closing
        # balance labels are kept (they carry the statement's real balances).
        boundary = page_headers.get(line.page_index, -1)
        if boundary >= 0 and line.line_no <= boundary:
            header_opening, header_closing = _capture_header_balance(
                line, layout, header_opening, header_closing
            )
            continue

        assigned = _assign_line(line, layout, single_amount_col)
        text = line.text.strip()

        if label_is_brought_forward(text) or label_is_carried_forward(text):
            continue

        has_balance = assigned["balance"] is not None
        has_date = bool(assigned["dates"])
        is_opening = label_is_opening(text)
        is_closing = label_is_closing(text)

        # A record is complete once it holds its running balance: every later
        # line starts a new record (handles multi-line descriptions where the
        # date appears on the middle/last fragment, not the first).
        if cur is not None and cur.balance is not None:
            records.append(cur)
            cur = None
        elif cur is not None and has_date and cur.date_tokens:
            # No-balance-column fallback: a fresh date while one is already
            # present means the previous row has ended.
            records.append(cur)
            cur = None

        if cur is None:
            cur = _RawRecord(page=line.page_index + 1, line_no=line.line_no)
            if is_opening:
                cur.is_opening = True
            if is_closing:
                cur.is_closing = True

        if assigned["dates"] and not cur.date_tokens:
            cur.date_tokens = list(assigned["dates"])
        if assigned["value_dates"] and not cur.value_date_tokens:
            cur.value_date_tokens = list(assigned["value_dates"])

        if cur.debit is None:
            cur.debit = assigned["debit"]
        if cur.credit is None:
            cur.credit = assigned["credit"]
        if cur.balance is None:
            cur.balance = assigned["balance"]

        desc = assigned["desc"]
        if desc:
            cur.desc_parts.append(desc)
        ref = assigned["reference"]
        if ref and not cur.reference:
            cur.reference = ref

        if is_opening:
            cur.is_opening = True
        if is_closing:
            cur.is_closing = True

    if cur is not None:
        records.append(cur)

    # Opening balance belongs first, closing balance last.
    if header_opening is not None:
        records.insert(0, header_opening)
    if header_closing is not None and not any(r.is_closing for r in records):
        records.append(header_closing)
    return [r for r in records if _is_transaction_like(r) and not _is_junk_record(r)]


def _is_junk_record(r: _RawRecord) -> bool:
    """Footer prose and empty phantom lines (no amounts, no balance) are not
    transactions. Date-only rows with an empty description are OCR noise."""
    if r.is_opening or r.is_closing:
        return False
    if r.debit is not None or r.credit is not None or r.balance is not None:
        return False
    desc = " ".join(r.desc_parts).strip()
    if not desc:
        return True
    return bool(_FOOTER_PROSE_RE.search(desc))


def _is_transaction_like(r: _RawRecord) -> bool:
    """A record without a date, amount, balance, reference or balance flag is
    stray prose (e.g. the footer disclaimer), not a transaction."""
    return bool(
        r.is_opening
        or r.is_closing
        or r.debit is not None
        or r.credit is not None
        or r.balance is not None
        or r.date_tokens
        or r.value_date_tokens
        or r.reference
    )


def _detect_page_headers(lines: list[Line], global_header_line_no: int) -> dict[int, int]:
    """First table-header line per page, used to skip the banner + per-page
    summary block that precedes the table on every page.

    The layout-detected header line (when it exists) is authoritative: it is
    the real table header, so it overrides any earlier match (e.g. a summary
    block that happens to read like a sub-header such as ``PAY IN PAY OUT``).
    Other pages fall back to their first header/sub-header line.
    """
    page_headers: dict[int, int] = {}
    for line in lines:
        page = line.page_index
        if page in page_headers:
            continue
        if _is_header_line(line) or _is_sub_header_line(line):
            page_headers[page] = line.line_no
    if global_header_line_no >= 0:
        for line in lines:
            if line.line_no == global_header_line_no:
                page_headers[line.page_index] = line.line_no
                break
    return page_headers


def _capture_header_balance(
    line: Line,
    layout: Layout,
    header_opening: Optional[_RawRecord],
    header_closing: Optional[_RawRecord],
) -> tuple[Optional[_RawRecord], Optional[_RawRecord]]:
    text = line.text.strip()
    if label_is_opening(text) and header_opening is None:
        return _make_balance_record(line, layout, opening=True), header_closing
    if label_is_closing(text) and header_closing is None:
        return header_opening, _make_balance_record(line, layout, opening=False)
    return header_opening, header_closing


def _make_balance_record(line: Line, layout: Layout, *, opening: bool) -> _RawRecord:
    balance = None
    for w in line.words:
        if layout.assign(w) == "balance":
            v = parse_amount(w.text)
            if v is not None:
                balance = v
                break
    if balance is None:
        for w in line.words:
            if looks_like_amount(w.text):
                v = parse_amount(w.text)
                if v is not None:
                    balance = v
                    break
    rec = _RawRecord(
        page=line.page_index + 1,
        line_no=line.line_no,
        is_opening=opening,
        is_closing=not opening,
    )
    rec.balance = balance
    rec.desc_parts = ["Opening Balance"] if opening else ["Closing Balance"]
    return rec


def _is_sub_header_line(line: Line) -> bool:
    """True for repeated sub-headers like ``POSTED DATE`` or ``VALUE DATE``."""
    from app.extraction.layout import COLUMN_KEYWORDS, _match_fields

    if not _match_fields(line):
        return False
    if any(any(ch.isdigit() for ch in w.text) for w in line.words):
        return False
    known = set(_HEADER_ONLY_WORDS)
    for kws in COLUMN_KEYWORDS.values():
        for kw in kws:
            known.update(kw.split())
    tokens = [re.sub(r"[^a-z]", "", w.text.lower()) for w in line.words if w.text.strip()]
    tokens = [t for t in tokens if t]
    if not tokens:
        return False
    for tok in tokens:
        if any(ch.isdigit() for ch in tok):
            return False
        if tok not in known:
            return False
    return True


def _has_separate_columns(layout: Layout) -> bool:
    return layout.column_for("debit") is not None or layout.column_for("credit") is not None


def _is_header_line(line: Line) -> bool:
    """True for the table header (and repeated headers on later pages)."""
    from app.extraction.layout import _match_fields

    fields = _match_fields(line)
    return len(fields) >= 3 and not fields.isdisjoint({"date", "description", "balance"})


def _assign_line(line: Line, layout: Layout, single_amount_col: bool) -> dict:
    dates: list[str] = []
    value_dates: list[str] = []
    desc_words: list[str] = []
    ref_words: list[str] = []
    debit_tokens: list[str] = []
    credit_tokens: list[str] = []
    balance_tokens: list[str] = []
    amount_tokens: list[str] = []
    date_fragments: list[str] = []
    value_fragments: list[str] = []
    has_date_col = layout.column_for("date") is not None or layout.column_for("value_date") is not None

    for w in line.words:
        field = layout.assign(w)
        if field == "date":
            if is_exact_date(w.text):
                dates.append(w.text)
            elif _is_date_fragment(w.text):
                date_fragments.append(w.text)
            else:
                desc_words.append(w.text)
        elif field == "value_date":
            if is_exact_date(w.text):
                value_dates.append(w.text)
            elif _is_date_fragment(w.text):
                value_fragments.append(w.text)
            else:
                desc_words.append(w.text)
        elif field == "reference":
            ref_words.append(w.text)
        elif field == "description":
            desc_words.append(w.text)
        elif field == "debit":
            if looks_like_date(w.text):
                desc_words.append(w.text)
            else:
                debit_tokens.append(w.text)
        elif field == "credit":
            if looks_like_date(w.text):
                desc_words.append(w.text)
            else:
                credit_tokens.append(w.text)
        elif field == "balance":
            if looks_like_date(w.text):
                desc_words.append(w.text)
            else:
                balance_tokens.append(w.text)
        elif field in ("branch", "channel", "instrument", "currency"):
            desc_words.append(w.text)
        else:
            # Unassigned word — decide by content. Only a token that is
            # exactly a date belongs in the date column; a narration that
            # merely contains a date is description text.
            if is_exact_date(w.text):
                dates.append(w.text)
            elif looks_like_amount(w.text):
                amount_tokens.append(w.text)
            else:
                desc_words.append(w.text)

    # A date split across adjacent word tokens (e.g. ``09 May 25`` as three
    # separate words) is reconstructed from the fragments before the fragments
    # fall through to the description.
    recon_dates, leftover = _reconstitute_dates(date_fragments)
    recon_values, value_leftover = _reconstitute_dates(value_fragments)
    dates.extend(recon_dates)
    value_dates.extend(recon_values)
    desc_words.extend(leftover)
    desc_words.extend(value_leftover)

    debit = _join_amount(debit_tokens, in_debit_column=True) if debit_tokens else None
    credit = _join_amount(credit_tokens, in_debit_column=False) if credit_tokens else None
    balance = _join_amount(balance_tokens, in_debit_column=None) if balance_tokens else None

    if single_amount_col and amount_tokens:
        amt = _join_amount(amount_tokens, in_debit_column=None)
        if amt is not None:
            if amt < 0:
                debit = -amt
            else:
                credit = amt

    return {
        "dates": dates,
        "value_dates": value_dates,
        "desc": clean_description(" ".join(desc_words)),
        "reference": " ".join(ref_words).strip(),
        "debit": debit,
        "credit": credit,
        "balance": balance,
    }


_DATE_FRAGMENT_RE = re.compile(
    r"^(?:\d{1,2}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|"
    r"January|February|March|April|June|July|August|September|October|November|December)$",
    re.IGNORECASE,
)


def _is_date_fragment(text: str) -> bool:
    """True when a date-column word could be part of a multi-word date."""
    return bool(text and _DATE_FRAGMENT_RE.fullmatch(text.strip()))


def _reconstitute_dates(fragments: list[str]) -> tuple[list[str], list[str]]:
    """Join date-column word fragments back into full dates.

    Some statements typeset dates like ``09 May 25`` as three separate words;
    each fragment alone fails :func:`is_exact_date`. Consecutive fragments are
    combined until they form a valid date. Fragments that never combine are
    returned as leftovers (column noise) so they survive as narration text.
    """
    out: list[str] = []
    leftover: list[str] = []
    i = 0
    while i < len(fragments):
        best: Optional[tuple[int, str]] = None
        for k in range(i, min(i + 5, len(fragments))):
            candidate = " ".join(fragments[i:k + 1])
            if is_exact_date(candidate):
                best = (k, candidate)
        if best is not None:
            i, date_tok = best
            out.append(date_tok)
            i += 1
        else:
            leftover.append(fragments[i])
            i += 1
    return out, leftover


def _join_amount(tokens: list[str], in_debit_column: Optional[bool]) -> Optional[float]:
    """Join amount tokens (handles split signs like ``-`` ``15,000``)."""
    if not tokens:
        return None
    merged = ""
    for i, tok in enumerate(tokens):
        if tok in ("-", "+"):
            if not merged:
                merged += tok
            continue
        merged += tok
    if not merged or not any(ch.isdigit() for ch in merged):
        return None
    val = parse_amount(merged)
    if val is None:
        return None
    return abs(val) if in_debit_column is not None else val


def to_transactions(
    records: list[_RawRecord],
    template: BankTemplate,
    include_balances: bool = True,
) -> list[Transaction]:
    """Convert raw records into model Transactions."""
    transactions: list[Transaction] = []
    for rec in records:
        tx_date = None
        if rec.date_tokens:
            for tok in rec.date_tokens:
                tx_date = _parse_date_token(tok, template)
                if tx_date:
                    break
        value_date = None
        if rec.value_date_tokens:
            for tok in rec.value_date_tokens:
                value_date = _parse_date_token(tok, template)
                if value_date:
                    break

        description = join_parts(rec.desc_parts)
        reference = rec.reference or extract_reference(description)
        debit = rec.debit
        credit = rec.credit

        if not include_balances:
            balance = None
        else:
            balance = rec.balance

        tx = Transaction(
            tx_date=tx_date,
            value_date=value_date,
            description=description,
            reference=reference,
            debit=debit,
            credit=credit,
            balance=balance,
            currency="NGN",
            is_beginning_balance=rec.is_opening,
            is_ending_balance=rec.is_closing,
            page_number=rec.page,
            line_number=rec.line_no,
            source_text=description,
        )
        transactions.append(tx)
    return transactions


def _parse_date_token(tok: str, template: BankTemplate):
    from app.extraction.fields import parse_date

    return parse_date(tok, day_first=template.date_day_first)
