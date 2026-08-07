"""Field-level parsing utilities: dates and amounts.

Handles the formats found across Nigerian and international bank statements,
including NGN thousands separators (1,234,567.89) and European decimal
commas (1.234.567,89).
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Optional

# Day-first formats are the norm for Nigerian banks. ISO listed last.
DAY_FIRST_FORMATS: list[str] = [
    "%d/%m/%Y",
    "%d/%m/%y",
    "%d-%m-%Y",
    "%d-%m-%y",
    "%d.%m.%Y",
    "%d.%m.%y",
    "%d %b %Y",
    "%d %b %y",
    "%d %b, %Y",
    "%d %B %Y",
    "%d %B %y",
    "%d-%b-%y",
    "%d-%b-%Y",
    "%Y-%m-%d",
    "%Y/%m/%d",
]

MONTH_FIRST_FORMATS: list[str] = [
    "%m/%d/%Y",
    "%m/%d/%y",
    "%m-%d-%Y",
    "%m-%d-%y",
    "%m.%d.%Y",
    "%m.%d.%y",
    "%b %d, %Y",
    "%b %d %Y",
    "%B %d, %Y",
    "%B %d %Y",
]

DATE_RE = re.compile(
    r"(?<!\d)"
    r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})"
    r"(?!\d)"
    r"|(?<!\w)(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|"
    r"January|February|March|April|June|July|August|September|October|November|December)"
    r"\.?\s+(\d{2,4})(?!\w)",
    re.IGNORECASE,
)

_MONTH_MAP = {m.lower(): i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec",
     "january", "february", "march", "april", "june", "july", "august", "september",
     "october", "november", "december"], start=0)}


def looks_like_date(text: str) -> bool:
    """Cheap check whether a token looks like a date (no parse)."""
    return DATE_RE.search(text) is not None


def is_exact_date(text: str) -> bool:
    """True when the whole token is a date (e.g. ``13/09/2022``), as opposed
    to merely containing one (e.g. a narration with an embedded date)."""
    if not text:
        return False
    return DATE_RE.fullmatch(text.strip()) is not None


def parse_date(text: str, day_first: bool = True) -> Optional[date]:
    """Parse a single date token. Returns None when not parseable."""
    if not text:
        return None
    raw = text.strip()
    if not raw:
        return None
    raw = raw.replace(",", " ").strip()

    # Named-month form can be handled generically.
    m = DATE_RE.search(raw)
    if m and m.group(4):
        try:
            return date(int(m.group(6)), _month_number(m.group(5)), int(m.group(4)))
        except ValueError:
            return None
    if m and m.group(1):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        y = _normalize_year(y)
        if _valid_day_month(d, mo, day_first, y):
            return date(y, mo, d)
        if not day_first and _valid_day_month(mo, d, True, y):
            return date(y, d, mo)

    formats = DAY_FIRST_FORMATS if day_first else MONTH_FIRST_FORMATS
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    # Last resort: try the other orientation.
    formats = MONTH_FIRST_FORMATS if day_first else DAY_FIRST_FORMATS
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue
    return None


def _month_number(name: str) -> int:
    return _MONTH_MAP[name.lower()]


def _normalize_year(y: int) -> int:
    if y < 100:
        return 2000 + y if y < 70 else 1900 + y
    return y


def _valid_day_month(d: int, m: int, day_first: bool, y: int) -> bool:
    if day_first:
        return 1 <= d <= 31 and 1 <= m <= 12
    return 1 <= m <= 12 and 1 <= d <= 31


_AMOUNT_RE = re.compile(
    r"(?<![\d.,])(?P<sign>[+-]?)(?P<num>[\d][\d.,]*)(?P<tag>\s*(?:DR|CR))?(?![\d.,])",
    re.IGNORECASE,
)


def looks_like_amount(text: str) -> bool:
    """Cheap check whether a token looks like a monetary amount."""
    if not text:
        return False
    s = _strip_currency(text)
    if not s:
        return False
    m = _AMOUNT_RE.match(s)
    return m is not None and len(m.group("num")) >= 1


def parse_amount(text: str) -> Optional[float]:
    """Parse a monetary amount to a float. Returns None when unparseable.

    Handles: 1,234,567.89 | 1.234.567,89 | 15,000 | 15.00 | (1,234.56)
    and DR/CR tags (DR -> negative, CR -> positive).
    """
    if text is None:
        return None
    s = _strip_currency(text)
    if not s:
        return None

    sign = 1.0
    if s.startswith("-"):
        sign = -1.0
        s = s[1:]
    elif s.startswith("+"):
        s = s[1:]

    up = s.upper().strip()
    if up.endswith("DR"):
        sign = -1.0
        s = s[:-2]
    elif up.endswith("CR"):
        sign = 1.0
        s = s[:-2]

    s = s.strip()
    if not s:
        return None

    # Parenthesised negative: (1,234.56)
    if s.startswith("(") and s.endswith(")"):
        sign *= -1.0
        s = s[1:-1]

    if not re.fullmatch(r"[0-9][0-9.,]*", s):
        return None

    has_comma = "," in s
    has_dot = "." in s

    try:
        if has_comma and has_dot:
            # The last-occurring separator is the decimal separator.
            if s.rfind(",") > s.rfind("."):
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif has_comma:
            parts = s.split(",")
            if len(parts) == 2 and len(parts[1]) == 2 and len(parts[0]) <= 4:
                s = s.replace(",", ".")
            else:
                s = s.replace(",", "")
        elif has_dot:
            parts = s.split(".")
            if not (len(parts) == 2 and len(parts[1]) == 2 and len(parts[0]) <= 4):
                s = s.replace(".", "")
        return round(float(s) * sign, 2)
    except ValueError:
        return None


def _strip_currency(text: str) -> str:
    s = text.strip()
    for sym in ("NGN", "N", "\u20a6", "$", "US$", "USD", "GBP", "EUR", "KES", "GHS", "ZAR"):
        if s.upper().startswith(sym.upper()) and len(s) > len(sym):
            s = s[len(sym):].strip()
            break
    for sym in ("NGN", "\u20a6", "$", "USD"):
        if s.upper().endswith(sym.upper()) and len(s) > len(sym):
            s = s[: -len(sym)].strip()
            break
    return s


def parse_signed_amount(word: str, in_debit_column: bool = True) -> Optional[float]:
    """Parse an amount, then force sign according to the column it belongs to.

    Debit columns produce negative amounts, credit columns positive. If the
    raw token carried its own DR/CR sign that sign wins.
    """
    val = parse_amount(word)
    if val is None:
        return None
    up = word.upper()
    if "DR" in up:
        return -abs(val)
    if "CR" in up:
        return abs(val)
    return -abs(val) if in_debit_column else abs(val)
