# 14 — Excel Export Strategy

Every return exports a workbook that **resembles the Worldmark/NAICOM format** — not a generic database dump (PRD §25). ExcelJS (styles: borders, fonts, number formats, merged title cells).

## Workbook structure

```
Sheet: <RETURN NAME>
┌────────────────────────────────────────────┐
│ WORLDMARK INSURANCE BROKERS LTD            │  merged title (company_name)
│ <RETURN NAME> — <PERIOD LABEL>             │  merged subtitle
│ NAICOM: <naicom_number>                    │  optional line
├────────────────────────────────────────────┤
│ <headers in template order>                │  bold, fill, borders
│ <data rows>                                │
│ <TOTAL row>                                │  bold, top double border
└────────────────────────────────────────────┘
```

## Export rules

| Aspect | Rule |
|---|---|
| Headers | Exact template header text + order (from `return_templates.export_format`) |
| Currency | NGN formatted `₦#,##0.00`; USD `$#,##0.00`; per `policies.currency` / column |
| Dates | `DD/MM/YYYY` (NAICOM/Nigeria convention) |
| NULL values | Blank cell or `NIL` per that return's convention — never raw NULL text (PRD §46) |
| Totals | Sum row for every numeric column; totals = recomputed from rows (flag if a row was manually overridden) |
| Company + return name | Top merged rows (company_name from `company`) |
| Period | Reporting period label (e.g. "Q1 2026") |
| Layout | Borders on table, header fill (navy), professional spacing |
| Print | Print-area + fit-to-width for PDF/print |

## Per-return specifics

| Return | Export notes |
|---|---|
| Income Production | Column order per `18` §1 (S/N, Date, Trans Ref, Policy No, Endorsement, Trans Type, Cover From/To, Assured, Customer, Broker/Agent, Ledger Acc, Sum Insured, Gross Premium, Brokerage, Net Premium, Tenor, End Date, Debit/Credit Note, Amount Received, Receipt Info, Remittance block, Remarks); Naira formatting; auto totals |
| PPS (PPS-A) | NAICOM 30-column layout per `18` §2 — clean headers (transaction type NEW/RNL/ADD/RTN, Credit Note Date, Originating Location/Branch, Remittance block); Sheet1 "Basic Form Information" auto-filled; totals |
| CRR | Columns per `18` §3 / PRD §13; commission & net-premium columns computed, overrides flagged |
| Businesses Generated | **Naira/Dollar split columns** — rows resolved by `currency` into NGN and USD columns (PRD §14); totals both |
| Personnel | Two sheets: First Schedule (staff list) + Second Schedule (summary of changes); Date of Exit blank when employed |
| Form 1C | Item, Insurer, totals row; grouped by insurer (layout pending file) |
| Brokerage Commission Register | Title `RETURNS - INSURANCE BROKERAGE COMMISSION REGISTER`, occurrence `Annually`; columns S/N, Name of Client, Name of Insurer, Policy No., Class of Business, Date of Policy, Sum Insured, Gross Premium, Commission Rate, Commission Earned, Withholding Tax (WHT), Net Commission Received, Date Commission Received, Receipt No., Remarks; Naira formatting; totals |
| PPS | Uses the confirmed PPS-A layout (see above) |

## Source-format fidelity notes

- Income Production source headers are merged/truncated (`18` §1) — the export uses the **clean PPS headers** so the workbook is NAICOM-ready, while keeping the Worldmark-branded title block (`WORLDMARK INSURANCE BROKERS LIMITED` / `INCOME PRODUCTION / FOR THE MONTH OF <MONTH> <YEAR>`).

## Formats

- **Excel** (`.xlsx`, styled) — primary.
- **CSV** (`.csv`) — plain, template headers, no styling.
- **PDF / Print** — client-side print (window.print / print CSS) with landscape tables.
- **Version snapshot** — each exported version is saved to `return_versions.snapshot` and Storage (`exports/`) for the audit trail (PRD §26).

## Reconciliation integration (PRD §23)

Export totals are the same values shown in the return builder and used by `reconciliation_results`; if a manual override exists, the export includes a footnote row noting the adjusted value vs computed value.
