# 04 — Return Catalogue

Configurable catalogue (`return_definitions`). Admin can add/edit any return without code changes (PRD §18, §41). Frequencies per PRD §18.

| Code | Return Name | Form/Ref | Frequency | Department | Data Source | Default Status |
|---|---|---|---|---|---|---|
| INCOME_PRODUCTION | Income Production | — | Monthly | Operations/Finance | `v_income_production` | Generated |
| PPS | Premium Income/Production Schedule | **PPS-A** | **Monthly** | Finance | `v_income_production` | Generated |
| CRR | Commission & Rebate Returns | — | Quarterly | Finance | `v_crr` | Generated |
| BUSINESSES_GENERATED | Schedule of Businesses Generated | — | Half-Yearly | Operations | `v_businesses_generated` | Generated |
| PERSONNEL | Personnel Returns | — | Quarterly | HR | `staff` table | Generated |
| FORM_1C | Form 1C | NAICOM Form 1C | Periodic (per directive) | Finance | `v_form_1c` | Generated |
| BROKERAGE_COMMISSION | Returns - Insurance Brokerage Commission Register | — | **Annual** | Finance | `v_brokerage_commission` | Generated |
| NEW_POLICIES | All New Policies | — | **Monthly** | Operations | `policies` | Generated |
| RENEWAL_POLICIES | All Renewal Policies | — | **Monthly** | Operations | `policies` | Generated |
| PREMIUM_COLLECTION | Premium Collection Report | — | Monthly | Finance | `v_premium_collections` | Report |
| PREMIUM_REMITTANCE | Premium Remittance Report | — | Monthly | Finance | `v_premium_remittances` | Report |
| COMMISSION_REPORT | Commission Report | — | Monthly | Finance | `v_commission_analysis` | Report |
| MANAGEMENT_REPORT | Management Report | — | Monthly/Quarterly | Management | KPIs + charts | Report |
| COMPLIANCE_REPORT | Regulatory Compliance Report | — | Quarterly | Management | cross-return | Report |

> **PPS resolved** (from `PPS.xlsx.csv`): PPS = **PREMIUM INCOME/PRODUCTION SCHEDULE**, NAICOM Form **PPS-A**, **Monthly**, 30-column layout. It and Income Production are two exports of the same underlying `policies` data — PPS is the NAICOM submission format, Income Production is the Worldmark internal format (see `18-excel-file-analysis.md` §1–2).

## Return definitions detail

### INCOME_PRODUCTION (Monthly)
Columns (PRD §12 + file §1 of `18`): S/N, Date, Transaction Reference, Policy Number, Endorsement, Transaction Type, Period From, Period To, Assured, Customer Name, Other Broker/Agent, Ledger Account Number, Sum Insured, Gross Premium, Brokerage Commission, Net Premium, Policy Tenor, End Date, Debit Note Number, Credit Note Number, Amount Received, Date of Receipt, Receipt No, Bank of Lodgement, Date of Lodgement, Remittance block, Remarks.

- Auto: date, ref, policy no., endorsement, type, cover periods, assured, customer, ledger, sums, premium, commission, net premium, tenor, debit/credit notes, collections, remittance block.
- Totals: Sum Insured, Gross Premium, Commission, Net Premium (auto).
- Actions: add/edit/delete/search/filter/sort/duplicate/bulk import/export/print/PDF (PRD §12).

### PPS — Premium Income/Production Schedule (PPS-A, Monthly)
- 30-column NAICOM layout per `18` §2. Generated from the **same `v_income_production`** rows as Income Production; export uses the clean PPS headers (NEW/RNL/ADD/RTN transaction types, Credit Note Date, Originating Location/Branch, Remittance block).
- Sheet1 "Basic Form Information" auto-fills: Form, Form ID = PPS-A, occurrence type = Monthly, Year, Quarter, Month, Filed By (responsible user), Date.

### CRR (Quarterly)
Columns (PRD §13): Date, Policy Number, Risk Type, Client Name, Insurer, Sum Insured, Gross Premium, Approved Commission Rate, Tax Paid, Net Commission Rate, Brokerage Commission, Other Deduction, Net Premium, Amount Received, Receipt Number, Remarks.

- Calculated (configurable): Commission = Gross Premium × Rate; Net Premium = Gross − Commission − Other Deduction; Net Commission Rate = Rate − deductions. **Never silently alter user figures** — a manual override stores the user value and flags a discrepancy (PRD §13).

### BUSINESSES_GENERATED (Half-Yearly)
Columns (PRD §14): S/N, Insured, Class of Business, Insurer, Gross Premium (NGN), Gross Premium (USD), Premium Collected (NGN), Premium Collected (USD), Date of Collection, Premium Paid (NGN), Premium Paid (USD), Date Premium Paid, Brokerage Commission (NGN), Brokerage Commission (USD).

- Periods: First Half, Second Half, Full Year. Totals auto.
- Currency split resolved at query/export time from `policies.currency`.

### PERSONNEL (Quarterly)
Two schedules (from file `18` §5):
1. **FIRST SCHEDULE** — Statement of Personnel Returns: S/N, Name of Staff, Staff Category, Designation, Gender, Educational Qualification, Professional Qualification, Date of Employment, State of Origin, Location, Date of Exit, Reason for Leaving.
2. **SECOND SCHEDULE** — Summary of Personnel Changes: Category of Staff (JUNIOR STAFF, SENIOR STAFF, LOWER MANAGEMENT, SENIOR MANAGEMENT, TOTAL) × Previous Total, Total Entry in Period, Total Exit in Period, Current Number — **derived** from the staff table (entries = employment within quarter; exits = exit within quarter; current = employed at quarter end).

- Generated from permanent **Staff Master**. A resignation updates the master once; the quarter's return reflects it automatically while historical submitted returns are preserved (PRD §15).

### FORM_1C
Fields (PRD §16): Item, Insurer, Gross Premium, Premium Collected, Premium Paid to Insurer, Commission. Totals auto. Generated from underlying policies grouped by insurer. Manual adjustment requires reason + user + date + audit log (generalized via `adjustments`).

### BROKERAGE_COMMISSION — Returns - Insurance Brokerage Commission Register (Annual)
Annual register of brokerage commission earned from insurers during the year, filed by registered insurance brokers under NAICOM returns guidelines.
Columns: S/N, Name of Client, Name of Insurer, Policy No., Class of Business, Date of Policy, Sum Insured, Gross Premium, Commission Rate, Commission Earned, Withholding Tax (WHT), Net Commission Received, Date Commission Received, Receipt No., Remarks.

- One row per policy written in the year; Net Commission Received = Commission Earned − WHT (derived; WHT is the policy-level `tax`).
- Totals: Sum Insured, Gross Premium, Commission Earned, Withholding Tax (WHT), Net Commission Received.
- Period: Full Year (`YYYY-FY`). Due 31 January of the following year (`due_date_rules` row `ddr-bcr`).
- Reconciles against CRR (sum of brokerage commission) via `rc-register`.
- Validation: required client/insurer/policy no./commission earned; money/date checks; commission-vs-rate and net-commission-vs-earned−WHT warnings.

### PPS
- **RESOLVED** — see PPS section above (Form PPS-A, Monthly, generated from `v_income_production`).

### NEW_POLICIES (Monthly) — All New Policies
Monthly schedule of **all new policies** written during the period (one row per policy where `transaction_type = 'NEW'`). Can be generated for any month.

Columns: S/N, Policy No., Trans. Ref., Transaction Date, Name of Client, Name of Insured, Name of Insurer, Class of Business, Risk Type, Sum Insured, Gross Premium, Premium Collected, Premium Paid to Insurer, Commission, Withholding Tax, Net Premium, **Premium Due Date**, Cover From, Cover To, **Renewal Due Date**, Premium Collection Date, Premium Payment Date, Receipt No., Bank of Lodgement, Currency, Branch Location, Remarks.

- **Premium Due Date** (derived) = `cover_from` — the premium falls due at cover inception.
- **Renewal Due Date** (derived) = `cover_to` — the expiry date that drives the next renewal.
- Totals: Sum Insured, Gross Premium, Premium Collected, Premium Paid to Insurer, Commission, Withholding Tax, Net Premium.
- Validation: required policy no./insured/insurer/gross premium; money and date checks incl. both due dates.

### RENEWAL_POLICIES (Monthly) — All Renewal Policies
Monthly schedule of **all renewed policies** during the period (one row per policy where `transaction_type = 'RENEWAL'`). Same columns, due-date derivations, totals and validation as NEW_POLICIES.

## Catalogue fields (per PRD §18)

Each definition stores: Return Name · Return Code/Form Number · Frequency · Reporting Period · Due Date · Responsible Department · Responsible User · Data Source · Status · Submission Date · Submission Reference · Attachment · Reviewer · Approval Date · Notes.
