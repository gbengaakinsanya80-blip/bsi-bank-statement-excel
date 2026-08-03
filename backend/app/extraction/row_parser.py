"""Row segmentation and multi-line transaction merging.

A transaction starts when a line carries a date (in the detected date
columns) — or, for layouts with no date column, when it carries both an
amount and a running balance. Continuation lines (no date) are merged into
the open transaction, joining descriptions and filling any missing amounts.
"""

from __future__ import annotations

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
from app.extraction.fields import looks_like_amount, looks_like_date, parse_amount, parse_signed_amount
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


def parse_rows(
    lines: list[Line],
    layout: Layout,
    template: BankTemplate,
    header_line_no: int = -1,
) -> list[_RawRecord]:
    records: list[_RawRecord] = []
    cur: Optional[_RawRecord] = None
    single_amount_col = not _has_separate_columns(layout)

    for line in lines:
        if header_line_no >= 0 and line.line_no <= header_line_no:
            continue
        if _is_header_line(line):
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
    return [r for r in records if r.has_content()]


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
    has_date_col = layout.column_for("date") is not None or layout.column_for("value_date") is not None

    for w in line.words:
        field = layout.assign(w)
        if field == "date":
            dates.append(w.text)
        elif field == "value_date":
            value_dates.append(w.text)
        elif field == "reference":
            ref_words.append(w.text)
        elif field == "description":
            desc_words.append(w.text)
        elif field == "debit":
            debit_tokens.append(w.text)
        elif field == "credit":
            credit_tokens.append(w.text)
        elif field == "balance":
            balance_tokens.append(w.text)
        elif field in ("branch", "channel", "instrument", "currency"):
            desc_words.append(w.text)
        else:
            # Unassigned word — decide by content.
            if has_date_col:
                if looks_like_date(w.text):
                    dates.append(w.text)
                elif looks_like_amount(w.text):
                    amount_tokens.append(w.text)
                else:
                    desc_words.append(w.text)
            else:
                if looks_like_date(w.text):
                    dates.append(w.text)
                elif looks_like_amount(w.text):
                    amount_tokens.append(w.text)
                else:
                    desc_words.append(w.text)

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
