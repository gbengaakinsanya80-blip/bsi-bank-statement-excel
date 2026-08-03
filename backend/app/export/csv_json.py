"""CSV and JSON export helpers."""

from __future__ import annotations

import csv
import io
import json
from typing import Optional

from app.core.models import ParsedStatement


def to_csv(parsed: ParsedStatement) -> bytes:
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow([
        "Beginning Balance", "Date", "Value Date", "Description", "Reference",
        "Debit", "Credit", "Balance", "Currency", "Branch", "Channel",
        "Instrument Number", "Transaction Type", "Category", "Page", "Line",
    ])
    for t in parsed.transactions:
        writer.writerow([
            t.balance if t.is_beginning_balance else "",
            t.tx_date.isoformat() if t.tx_date else "",
            t.value_date.isoformat() if t.value_date else "",
            t.description,
            t.reference,
            t.debit if t.debit is not None else "",
            t.credit if t.credit is not None else "",
            t.balance if t.balance is not None else "",
            t.currency,
            t.branch,
            t.channel,
            t.instrument_number,
            t.tx_type,
            t.category,
            t.page_number,
            t.line_number,
        ])
    return out.getvalue().encode("utf-8-sig")


def to_json(parsed: ParsedStatement, include_raw: bool = False) -> bytes:
    return json.dumps(
        parsed.to_dict(include_raw=include_raw), indent=2, default=str
    ).encode("utf-8")
