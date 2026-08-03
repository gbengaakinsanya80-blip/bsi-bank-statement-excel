"""Transaction parser.

Converts positioned words into structured Transaction records by:

- assigning each word to a detected column (or "description" by default)
- grouping words into candidate rows via vertical proximity
- detecting transaction rows via dates / amounts
- intelligently merging multi-line transaction fragments
- cleaning and joining descriptions without truncation
- detecting beginning & ending balance records
- extracting reference numbers, value dates, branch, channel, instrument no.
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Optional

from ..core.config import AMOUNT_RE
from ..core.models import Transaction
from .banks import BankTemplate, get_template
from .categorizer import categorize
from .layout_detector import Layout
from .pdf_reader import PageData, Word

# --------------------------------------------------------------------------- #
# Date parsing
# --------------------------------------------------------------------------- #
DATE_TOKEN_RE = re.compile(
    r"^(?P<date>\d{1,4}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{1,2}[a-zA-Z]{3}\s?\d{2,4}|[a-zA-Z]{3}\s?\d{1,2},?\s?\d{2,4})$"
)
VALUE_DATE_PREFIX = re.compile(r"^V\.?D\.?|^VAL\.? ?DT|^VALUE$", re.IGNORECASE)

# --------------------------------------------------------------------------- #
# Amount parsing
# --------------------------------------------------------------------------- #
def parse_amount(token: str) -> Optional[float]:
    """Parse an amount token, handling thousands separators.

    Handles both 1,234,567.89 and 1.234.567,89 styles, and a leading sign.
    Returns None if the token is not a plain number (account numbers and
    other long digit runs without decimals are rejected).
    """
    t = token.strip()
    if not t:
        return None
    negative = False
    if t.startswith("-"):
        negative = True
        t = t[1:]
    elif t.startswith("+"):
        t = t[1:]
    if t.startswith("(") and t.endswith(")"):
        negative = True
        t = t[1:-1]
    t = t.replace(" ", "")

    # European thousands style: 1.234.567,89
    m = re.fullmatch(r"(\d{1,3})(?:\.\d{3})+,(\d{2})", t)
    if m:
        digits = t.replace(".", "").replace(",", ".")
        val = float(digits)
        return -val if negative else val

    if "," in t:
        # Comma-thousands (1,234,567.89 or 1,234,567)
        if re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d{2})?", t):
            val = float(t.replace(",", ""))
            return -val if negative else val
        return None
    if "." in t:
        # Dot-decimal: 123.45
        if re.fullmatch(r"\d+\.\d{2}", t):
            val = float(t)
            return -val if negative else val
        return None
    # Bare integer: only accept plausible amounts (no account numbers).
    if re.fullmatch(r"\d{1,6}", t):
        val = float(t)
        return -val if negative else val
    return None


def parse_amount_in_token(token: str) -> Optional[float]:
    """Parse the best amount-looking substring inside a token.

    Handles tokens like 'LAGOS68,142.50' (description bleeding into the amount
    column). Prefers the LAST amount-like match in the token since amounts are
    typically trailing.
    """
    matches = list(AMOUNT_RE.finditer(token))
    if not matches:
        return None
    # Try matches from longest to shortest, preferring the last occurrence.
    for m in reversed(matches):
        a = parse_amount(m.group("amount"))
        if a is not None:
            return a
    return None


def is_amount_token(token: str) -> bool:
    return parse_amount(token) is not None


# --------------------------------------------------------------------------- #
# Row grouping
# --------------------------------------------------------------------------- #
class Parser:
    def __init__(self, layout: Layout, template: BankTemplate) -> None:
        self.layout = layout
        self.template = template
        self._cols: dict[str, tuple[float, float]] = {}
        for c in layout.column_defs:
            self._cols[c.key] = (c.x0, c.x1)

    # ------------------------------------------------------------------ #
    def parse(self, pages: list[PageData]) -> list[Transaction]:
        transactions: list[Transaction] = []
        self._last_balance: Optional[float] = None
        for page in pages:
            transactions.extend(self._parse_page(page))
        for tx in transactions:
            tx.category = categorize(tx.description)
        return transactions

    def _parse_page(self, page: PageData) -> list[Transaction]:
        rows = self._group_rows(page)
        transactions: list[Transaction] = []
        buffer: Optional[Transaction] = None
        line_index = 0

        for row in rows:
            line_index += 1
            cell_text, cell_words = self._assign_columns(row, page.width)
            joined = " ".join(w.text for w in row)

            if self._is_noise_line(joined):
                continue

            date_hit = self._first_date_token(cell_text.get("date", []))
            has_amount = any(
                is_amount_token(t)
                for key in ("debit", "credit", "balance")
                for t in cell_text.get(key, [])
            )

            # Beginning / ending balance row
            joined_desc = " ".join(cell_text.get("description", []))
            is_balance_record = self._is_balance_record(cell_text, joined_desc, has_amount)

            if buffer is not None:
                # Continuation line: has no date but carries more text / amounts
                if date_hit is None and (cell_words or has_amount):
                    self._merge_continuation(buffer, cell_text, cell_words, page.page_number, line_index, has_amount)
                    if has_amount and buffer.debit is not None and buffer.credit is not None:
                        # Amounts resolved on continuation -> flush buffer
                        transactions.append(buffer)
                        buffer = None
                    continue
                transactions.append(buffer)
                buffer = None

            if date_hit is not None or has_amount or is_balance_record:
                tx = self._build_transaction(cell_text, cell_words, date_hit, has_amount, is_balance_record, page, line_index)
                if has_amount:
                    transactions.append(tx)
                else:
                    buffer = tx
            elif cell_words:
                # Unrecognised line; keep as unreadable marker if it looks like
                # a transaction fragment (has digits).
                if any(re.search(r"\d", " ".join(w.text for w in row)) for w in row):
                    tx = self._build_transaction(cell_text, cell_words, None, False, False, page, line_index)
                    tx.is_estimated = True
                    tx.description = joined_desc or "UNREADABLE"
                    transactions.append(tx)

        if buffer is not None:
            transactions.append(buffer)
        return transactions

    # ------------------------------------------------------------------ #
    def _group_rows(self, page: PageData) -> list[list[Word]]:
        words = sorted(page.words, key=lambda w: (w.top, w.x0))
        rows: list[list[Word]] = []
        for w in words:
            placed = False
            for row in rows:
                if row and abs(w.top - row[0].top) < max(4, 0.7 * (row[0].bottom - row[0].top)):
                    row.append(w)
                    placed = True
                    break
            if not placed:
                rows.append([w])
        for row in rows:
            row.sort(key=lambda x: x.x0)
        return rows

    def _assign_columns(self, row: list[Word], page_width: float) -> tuple[dict[str, list[str]], dict[str, list[Word]]]:
        cell_text: dict[str, list[str]] = {}
        cell_words: dict[str, list[Word]] = {}
        if not self._cols:
            # No detected columns: everything goes to description.
            cell_text["description"] = [w.text for w in row]
            cell_words["description"] = list(row)
            return cell_text, cell_words

        bounds = sorted(self._cols.items(), key=lambda kv: kv[1][0])
        for w in row:
            key = None
            for k, (lo, hi) in bounds:
                if w.center_x >= lo and w.center_x <= hi:
                    key = k
                    break
            if key is None:
                # Fall back to the nearest column centre using word centre_x.
                key = min(
                    self._cols.keys(),
                    key=lambda k: abs(((self._cols[k][0] + self._cols[k][1]) / 2.0) - w.center_x),
                )
            cell_text.setdefault(key, []).append(w.text)
            cell_words.setdefault(key, []).append(w)
        return cell_text, cell_words

    # ------------------------------------------------------------------ #
    def _is_noise_line(self, text: str) -> bool:
        low = " ".join(text.lower().split())
        if not low:
            return True
        noise_markers = [
            "account name", "account no", "acc no", "account number",
            "statement of account", "account statement", "bank statement",
            "statement period", "transaction history", "transactions enquiry",
            "currency:", "dear ", "printed on", "generated on", "e-statement",
            "www.", "http://", "https://", "@", "branch:", "address:",
            "customer service", "page ", "statement of account",
            "this statement", "swift", "sort code", "iban",
        ]
        for marker in noise_markers:
            if marker in low:
                return True
        # Bank header lines (e.g. "FIRST BANK OF NIGERIA PLC | Account Statement")
        for bank_hint in self.template.keywords:
            if bank_hint and bank_hint in low and any(
                w in low for w in ("statement", "bank", "account")
            ):
                return True
        return False

    def _first_date_token(self, tokens: list[str]) -> Optional[datetime]:
        for tok in tokens:
            if VALUE_DATE_PREFIX.match(tok):
                continue
            m = DATE_TOKEN_RE.match(tok)
            if not m:
                continue
            return self._parse_date_token(tok)
        return None

    def _parse_date_token(self, token: str) -> Optional[datetime]:
        clean = token.strip()
        for fmt in self.template.date_formats:
            try:
                return datetime.strptime(clean, fmt)
            except ValueError:
                continue
        # Try short month formats dynamically
        try:
            return datetime.strptime(clean, "%d/%m/%y")
        except ValueError:
            pass
        return None

    def _is_balance_record(self, cell_text: dict[str, list[str]], joined_desc: str, has_amount: bool) -> bool:
        desc = " ".join(cell_text.get("description", [])).lower()
        tokens = [t for key in ("debit", "credit", "balance") for t in cell_text.get(key, [])]
        is_amount_only = has_amount and len(tokens) <= 3
        for kw in self.template.beginning_balance_keywords:
            if kw and kw.lower() in desc:
                return True
        if is_amount_only and desc == "" and self._last_balance is None and tokens:
            return True
        return False

    # ------------------------------------------------------------------ #
    def _build_transaction(
        self,
        cell_text: dict[str, list[str]],
        cell_words: dict[str, list[Word]],
        date_hit: Optional[datetime],
        has_amount: bool,
        is_balance_record: bool,
        page: PageData,
        line_index: int,
    ) -> Transaction:
        tx = Transaction(page_number=page.page_number, line_number=line_index)

        date_tokens = cell_text.get("date", [])
        date_val = date_hit
        value_tokens: list[str] = []

        # Value date sometimes sits in the same cell as date (e.g. '01/03/26').
        for tok in date_tokens:
            if VALUE_DATE_PREFIX.match(tok):
                value_tokens.append(tok)
        if len(date_tokens) >= 2 and date_val is not None:
            # Look for a second date-like token = value date.
            for tok in date_tokens[1:]:
                d = self._parse_date_token(tok)
                if d is not None:
                    tx.value_date = d.date()
                    break

        if date_val is not None:
            tx.tx_date = date_val.date()

        # Value date column
        for tok in cell_text.get("value_date", []):
            d = self._parse_date_token(tok)
            if d is not None:
                tx.value_date = d.date()

        # Description
        desc_tokens: list[str] = []
        desc_tokens.extend(cell_text.get("description", []))
        if not desc_tokens:
            # Description-less rows: leftover unassigned text (rare)
            pass
        tx.description = self._clean_description(" ".join(desc_tokens))

        # Reference
        ref_tokens = cell_text.get("reference", [])
        if ref_tokens:
            tx.reference = " ".join(ref_tokens).strip()
        else:
            tx.reference = self._extract_reference(tx.description)

        # Amounts
        debit = self._first_amount(cell_text.get("debit", []))
        credit = self._first_amount(cell_text.get("credit", []))
        balance = self._first_amount(cell_text.get("balance", []))
        if debit is None and "debit" not in self._cols:
            debit = self._guess_debit(cell_text.get("debit", []), balance)
        if credit is None and "credit" not in self._cols:
            credit = self._guess_credit(cell_text.get("credit", []), balance)
        if balance is None and self._last_balance is not None and (debit is not None or credit is not None):
            b = self._last_balance - (debit or 0.0) + (credit or 0.0)
            if abs(b - self._last_balance) < 1e9:
                balance = b
        tx.debit = debit
        tx.credit = credit
        tx.balance = balance
        if balance is not None:
            self._last_balance = balance

        # Beginning balance
        desc_lower = tx.description.lower()
        if is_balance_record or any(kw and kw.lower() in desc_lower for kw in self.template.beginning_balance_keywords):
            tx.is_beginning_balance = True
            tx.tx_type = "Opening Balance"
            if tx.balance is None:
                tx.balance = debit if debit is not None else credit
                self._last_balance = tx.balance

        # Metadata columns
        tx.branch = " ".join(cell_text.get("branch", [])).strip()
        tx.channel = " ".join(cell_text.get("channel", [])).strip()
        tx.instrument_number = " ".join(cell_text.get("instrument_number", [])).strip()
        tx.tx_type = " ".join(cell_text.get("tx_type", [])).strip() or tx.tx_type

        # Channel detection from description
        if not tx.channel:
            tx.channel = self._detect_channel(tx.description)

        # Source text for debugging
        tx.source_text = " ".join(w.text for w in cell_words.get("description", []))
        if tx.reference and tx.reference in tx.source_text:
            pass
        tx.source_text = tx.description

        return tx

    # ------------------------------------------------------------------ #
    def _merge_continuation(
        self,
        buffer: Transaction,
        cell_text: dict[str, list[str]],
        cell_words: dict[str, list[Word]],
        page_number: int,
        line_index: int,
        has_amount: bool,
    ) -> None:
        extra_desc = " ".join(cell_text.get("description", [])).strip()
        if extra_desc:
            if buffer.description and not buffer.description.endswith(" "):
                buffer.description = f"{buffer.description} {extra_desc}"
            else:
                buffer.description = f"{buffer.description}{extra_desc}"
            buffer.description = self._clean_description(buffer.description)
        if buffer.reference == "":
            ref = self._extract_reference(extra_desc)
            if ref:
                buffer.reference = ref
        if has_amount:
            if buffer.debit is None:
                buffer.debit = self._first_amount(cell_text.get("debit", []))
            if buffer.credit is None:
                buffer.credit = self._first_amount(cell_text.get("credit", []))
            bal = self._first_amount(cell_text.get("balance", []))
            if bal is not None:
                buffer.balance = bal
                self._last_balance = bal
            if buffer.debit is not None and buffer.credit is None:
                buffer.credit = None
            if buffer.credit is not None and buffer.debit is None:
                buffer.debit = None
        if not buffer.channel:
            buffer.channel = self._detect_channel(buffer.description)

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _first_amount(self, tokens: list[str]) -> Optional[float]:
        for t in tokens:
            a = parse_amount(t)
            if a is not None:
                return a
        for t in tokens:
            a = parse_amount_in_token(t)
            if a is not None:
                return a
        return None
    def _guess_debit(self, tokens: list[str], balance: Optional[float]) -> Optional[float]:
        # When debit & credit share a single 'Amount' column, decide via balance.
        if not tokens:
            return None
        amt = self._first_amount(tokens)
        if amt is None:
            return None
        if self._last_balance is not None and balance is not None:
            if abs(self._last_balance - amt - balance) < 0.01:
                return amt
        return None

    def _guess_credit(self, tokens: list[str], balance: Optional[float]) -> Optional[float]:
        if not tokens:
            return None
        amt = self._first_amount(tokens)
        if amt is None:
            return None
        if self._last_balance is not None and balance is not None:
            if abs(self._last_balance + amt - balance) < 0.01:
                return amt
        return None

    def _clean_description(self, text: str) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        text = text.rstrip(".,;")
        # Join common broken fragments like "SHOPRITE" "ABUJA"
        return text

    def _extract_reference(self, description: str) -> str:
        m = re.search(r"(?:Txn|Ref|Transaction)?[ :]?([A-Z0-9]{6,})", description, re.IGNORECASE)
        if m:
            return m.group(1)
        return ""

    def _detect_channel(self, description: str) -> str:
        d = description.lower()
        if "pos" in d:
            return "POS"
        if "atm" in d:
            return "ATM"
        if "transfer" in d or "ft " in d or "intra-bank" in d or "nuban" in d:
            return "Transfer"
        if "ussd" in d or "transfer via" in d:
            return "USSD"
        if "web" in d:
            return "Web"
        if "mobile" in d or "app" in d:
            return "Mobile"
        if "card" in d:
            return "Card"
        if "salary" in d:
            return "Salary"
        if "interest" in d:
            return "Interest"
        if "charge" in d or "commission" in d or "vat" in d or "sms" in d:
            return "Charge"
        if "cheque" in d or "cheque" in d:
            return "Cheque"
        return ""
