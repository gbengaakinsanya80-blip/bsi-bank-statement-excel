# 18 — Worldmark Excel File Analysis

PRD §59 Step 1: inspection of all supplied Worldmark files. This is the authoritative reference for column layouts, data sources, and data-quality findings. It refines the templates in `04`, the mappings in `06`, and the import/export rules in `13`/`14`.

## Files received

| File | Type | Sheets | Verdict |
|---|---|---|---|
| `2026 JUNE INCOME PRODUCTION.xlsx` | xlsx | Sheet1 (34 cols) | Income Production layout |
| `2026 JUNE INCOME PRODUCTION - Copy - Copy.xlsx` | xlsx | identical | **Duplicate** of above — ignore |
| `PPS.xlsx.csv` | **xlsx renamed** | 2 sheets | NAICOM PPS template |
| `PPS.xlsx (2).csv` | **xlsx renamed** | identical | **Duplicate** — ignore |
| `2026 CRR FOR FIRST QUARTER.xlsx` | xlsx | Sheet1 (16 cols) | CRR layout |
| `2022 FIRST QUARTER CRR.xlsx` | xlsx | Sheet1 (16 cols) | CRR layout (historical example) |
| `2026 BUSINESSES GENERATED FIRST HALF YEAR...xlsx` | xlsx | Sheet1 (15 cols) | Businesses Generated layout |
| `2026 SECOND QUARTER PERSONNEL RETURNS.xlsx` | xlsx | Sheet1 (12 cols) | Personnel: **two schedules** |
| `2025 form 1c (1).xlsx` | — | — | **NOT SUPPLIED** — Form 1C template pending |

> Note: both `.csv` PPS files are actually binary `.xlsx` (zip) renamed to `.csv`. The import pipeline must sniff file type by content, not extension (PRD §45 robustness).

---

## 1. Income Production (Worldmark internal format) — MONTHLY

Header rows 8–9 (merged/truncated in source; cleaned here). Source row sample: HOME MALL RENEWAL.

| # | Header | Sample value | DB field |
|---|---|---|---|
| A | S/N | 1 | — |
| B | DATE | 2026-04-06 | transaction_date |
| C | TRANS. REF. | NIL | transaction_reference |
| D | POLICY NO | NA | policy_number |
| E | ENDORSEMENT | NIL | endorsement_number |
| F | TRANS. TYPE | RENEWAL | transaction_type |
| G | PERIOD COVER FROM | 2026-04-06 | cover_from |
| H | PERIOD COVER TO | 2027-03-06 | cover_to |
| I | NAME OF ASSURED | HOME MALL | insured_name |
| J | CUSTOMER NAME | HOME MALL | clients.client_name |
| K | NAME OF OTHER BROKERS/AGENT | WORLDMARK | broker_or_agent |
| L | LEDGER ACC. NO | NIL | ledger_account |
| M | SUM INSURED | NA | sum_insured |
| N | GROSS PREMIUM | 1982042.3 | gross_premium |
| O | BROKERAGE | 297341.89 | brokerage_commission |
| P | NET PREMIUM | 1242544.82 | net_premium |
| Q | POLICY TENOR | 365 | derived cover_to−cover_from |
| R | END DATE | 2027-03-06 | cover_to |
| S | DEBIT NOTE NO | NA | debit_note_number |
| T | CREDIT NOTE NO | NA | credit_note_number |
| U | AMOUNT RECEIVED | 1982042.3 | amount_received |
| V | DATE OF RECEIPT OF PREMIUM | 2026-04-06 | premium_collection_date |
| W | RECEIPT NO. | Nil | receipt_number |
| X | NAME OF BANK OF LODGEMENT | Fidelity | collection bank |
| Y | DATE OF LODGEMENT | 2026-04-06 | (collection metadata) |
| Z–AE | Remittance block (FIN / amount remitted / unremitted / transferred / bank / cheque no / insurer receipt no / balance) | FIN / 1242544.82 / 441872.84 / … | policy_remittances + flags |
| AF–AH | DATE TO REMIT | 3 | remarks block |

**Finding**: header is messy (merged cells, "NAME OF MENT"). The **PPS template is the clean source of truth** for this return's layout — export should use PPS-style headers (see §2). Income Production is the Worldmark-branded monthly schedule built from the same rows.

---

## 2. PPS — PREMIUM INCOME/PRODUCTION SCHEDULE (NAICOM Form PPS-A) — MONTHLY

Sheet1 = Basic Form Information (Form, Form ID = **PPS-A**, Form Occurrence Type = **Monthly**, Year, Bi-Year, Quarter, Month, Day, Date, Filed By, Comments).
Sheet2 = the 30-column schedule (identical concept to Income Production, cleaner headers):

S/No · Policy No · Endorsement No · Transaction Type **(NEW, RNL, ADD, RTN)** · From Date · To Date · Assured · Customer Name · Name of Broker/Agent · Sum Insured · Premium · Brokerage · Net Prem · Policy Tenor (Days) · Debit Note · Credit Note No · Credit Note Date (from Broker) · Originating Location or Branch · Amount Received · Date of Receipt of Premium · Receipt No · Name of Bank of Lodgement · Date of Lodgement · Name of Insurer(s) · Amount Remitted · Amount Unremitted · Date Remitted/Transferred · Name of Bank · Cheque No/Transfer Ref · Receipt No · Remarks

- **Frequency: Monthly** (confirmed from the form definition).
- **Relationship**: PPS and Income Production are two exports of the same underlying policy data. PPS = NAICOM submission layout; Income Production = Worldmark internal layout.
- PPS is added to the return catalogue as a first-class return (MONTHLY), sourced from `policies` + `policy_collections` + `policy_remittances`.

---

## 3. CRR — Commission & Rebate Returns — QUARTERLY

Header (rows 6, both 2022 & 2026 files identical): DATE · POLICY NO · RISK TYPE · NAME OF CLIENT · NAME OF INSURER · SUM INSURED · GROSS PREMIUM · APPROVED COMMISSION RATE · TAX PAID · NET COMMISSION RATE · BROKERAGE COMMISSION · OTHER DEDUCTION · NET PREMIUM · AMOUNT RECEIVED · RECEIPT NO · REMARKS. Confirms PRD §13.

Auto-calcs verified against source rows: Commission = Gross × Rate (e.g. 153000 × 9% = 13,770 ≈ 13,802.6 — small variances exist in source). Net Premium = Gross − Commission − Other Deduction.

Title pattern: `COMMISSION AND REBATE RETURNS (CRR) — FOR THE FIRST QUARTER ENDED 31ST MARCH, 2026`.

---

## 4. Businesses Generated — HALF-YEARLY (First/Second Half/Full Year)

Two-row group header (row 3 group labels + row 4 column labels; row 5 = ₦/$ symbols).

| # | Column | Sample |
|---|---|---|
| A | S/N | 1 |
| B | INSURED | ADEWALE BELLO& CO |
| C | CLASS OF BUSINESS | GLA |
| D | INSURER | EMPLE |
| E | GROSS PREMIUM NAIRA | 13802.5 |
| F | GROSS PREMIUM DOLLAR | (blank) |
| G | PREMIUM COLLECTED NAIRA | 153300 |
| H | PREMIUM COLLECTED DOLLAR | (blank) |
| I | DATE OF COLLECTION | 2026-01-17 |
| J | PREMIUM PAID NAIRA | 139497.5 |
| K | PREMIUM PAID DOLLAR | (blank) |
| L | DATE OF PREMIUM PAID | 2026-01-19 |
| M | BROKERAGE COMMISSION NAIRA | 13802.5 |
| N | BROKERAGE COMMISSION DOLLAR | (blank) |

Title pattern: `SCHEDULE OF BUSINESSES GENERATED BTW 1ST JANUARY 2026 TO 30TH JUNE 2026`. Periods: First Half, Second Half, Full Year (PRD §14).

**Data-quality finding**: in the source rows, GROSS PREMIUM ≈ COMMISSION and PREMIUM COLLECTED ≈ ~10× GROSS (e.g. 13,802.5 vs 153,300). Cross-check with CRR (ADEWALE & CO: gross 153,000, rate 9%) shows the "GROSS PREMIUM" figure is actually the **commission** — i.e. the source spreadsheet contains inconsistent conventions. The system must **not** replicate this: it stores true gross premium/commission and flags discrepancies via the reconciliation engine. (NNPCL USD rows: `USD 162944.5997` text in NAIRA column — must parse as currency-tagged amount.)

---

## 5. Personnel Returns — QUARTERLY (two schedules)

### FIRST SCHEDULE — Statement of Personnel Returns
S/N · NAME OF STAFF · STAFF CATEGORY · DESIGNATION · GENDER · EDUCATIONAL QUALIFICATION · PROFESSIONAL QUALIFICATION · DATE OF EMPLOYMENT · STATE OF ORIGIN · LOCATION · DATE OF EXIT · REASONS FOR LEAVING. (PRD §15 confirmed; header spans rows 9–10.)

### SECOND SCHEDULE — Summary of Personnel Changes During the Quarter
CATEGORY OF STAFF | PREVIOUS NUMBER TOTAL | TOTAL ENTRY DURING THE PERIOD | TOTAL EXIT DURING THE PERIOD | CURRENT NUMBER — rows: JUNIOR STAFF, SENIOR STAFF, LOWER MANAGEMENT, SENIOR MANAGEMENT, TOTAL.

- Categories observed: SENIOR MANAGEMENT, SENIOR OFFICER, JUNIOR OFFICER, SENIOR STAFF (first schedule) vs JUNIOR/SENIOR STAFF, LOWER/SENIOR MANAGEMENT (second schedule). Staff category master should standardise on the second-schedule set: **JUNIOR STAFF, SENIOR STAFF, LOWER MANAGEMENT, SENIOR MANAGEMENT** and map legacy labels at import.
- The summary schedule is **derived** from the staff table: entries = date_of_employment within quarter; exits = date_of_exit within quarter; current = employed at quarter end.

---

## 6. Form 1C

Template file not supplied. Design from PRD §16 stands (Item · Insurer · Gross Premium · Premium Collected · Premium Paid to Insurer · Commission, insurer-grouped totals). Pending file for exact layout.

---

## Cross-file data-quality findings (validated PRD §45/§48/§49)

| Issue | Example | System behaviour |
|---|---|---|
| Text dates in mixed formats | `14/1/2022`, `31/12/16`, `35/6/2026`, `30/4/223` | Flexible date parser → ISO; invalid dates rejected with message |
| Wrong-century/format dates | `2026-11-02` (likely 2 Nov), `2026-06-03` (3 Jun), `2026-09-03` | Ambiguity flagged for confirmation; never auto-guessed silently |
| Invalid percentage | `12..5` (CRR 2026) | Rejected with `"Invalid percentage. Enter a number such as 12.5."` |
| NA / NIL sentinels | policy no `NA`, `NIL`, blank | Stored as NULL (PRD §46) |
| Currency-symbol text | `USD 162944.5997` in Naira column | Currency-tagged parse → numeric + currency |
| Insurer name variants | EMPLE / EMPLE INS / EMPLE INSURANCE; NEM / NEM/LINKAGE; VARIOUS | Normalized + **POSSIBLE DUPLICATE** review (PRD §49) |
| Risk-type variants | GROUP LIFE, MOTOR, FIRE/BURGLARY, GLOBAL POLICIES, GLA, MV, apg, various | Mapped to risk_classes; unknown → admin resolution |
| Duplicate files | `- Copy - Copy`, `(2)` | Migration uses canonical file only |
| Header messiness | merged/truncated headers in Income Production | Export uses clean PPS-style headers |
| Commission conventions | Businesses Generated GROSS≈COMMISSION | Store true values; reconciliation flags mismatch |
