"""Generate a simple demo bank statement PDF for manual testing.

Writes ``demo_statement.pdf`` into the project root. Upload it from the
dashboard to run the whole pipeline: upload -> parse -> validate -> link to a
company -> classify -> approve -> post -> Reports / Ledger.
"""

from __future__ import annotations

from pathlib import Path

from tests.generators.make_statements import build_statement_pdf

OUT = Path(__file__).resolve().parent.parent.parent / "demo_statement.pdf"


def main() -> None:
    truth = build_statement_pdf(
        OUT,
        bank="Zenith Bank",
        account_name="DEMO TRADING CO",
        account_number="0123456789",
        n_transactions=12,
        rows_per_page=25,
        split_desc=True,
        opening=5_000_000.00,
        seed=21,
    )
    txs = truth["transactions"]
    total_dr = round(sum(t["debit"] or 0 for t in txs), 2)
    total_cr = round(sum(t["credit"] or 0 for t in txs), 2)
    print(f"Wrote {OUT}")
    print(f"transactions={len(txs)}  total_debit={total_dr:,.2f}  total_credit={total_cr:,.2f}")


if __name__ == "__main__":
    main()
