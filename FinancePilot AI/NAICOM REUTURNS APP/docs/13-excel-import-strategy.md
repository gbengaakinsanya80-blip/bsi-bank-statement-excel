# 13 — Excel Import Strategy

> **Status: IMPLEMENTED (Phase 4)** — `src/lib/import/` (`xlsx-reader`, `mapping`, `validation`, `session-store`, `import-actions`, `writer`) + `/import` wizard + `/api/import/[id]/report`. Note: sessions are file-backed in preview mode; live mode additionally persists to Supabase `policies`.

Pipeline per PRD §24: **UPLOAD → READ → PREVIEW → MAP COLUMNS → VALIDATE → IMPORT**. Plus reusable mapping templates (PRD §47) and normalization (PRD §48/§49).

## Pipeline stages

1. **UPLOAD** — file → Supabase Storage (`imports` bucket); `import_jobs` row created (UPLOADED). **File type sniffed by content, not extension** (the supplied `PPS.xlsx.csv` files are xlsx binaries — PRD §45 robustness).
2. **READ** — SheetJS parses workbook client or server-side; header row detected (auto-detect or user-picked row).
3. **PREVIEW** — first N rows rendered; row/column counts shown; duplicates pre-detected.
4. **MAP COLUMNS** — Excel header → database field (`import_mappings`); saved templates for reuse. Unknown/unmapped columns ignored with notice.
5. **VALIDATE** — per-row rules (required, types, ranges, normalization) → counts:
   - total rows, valid rows, invalid rows, duplicate rows, missing fields.
   - Invalid rows listed with human-readable reasons (e.g. `"12..5"` commission rate).
6. **IMPORT** — "Import Valid Records" only; **never** import bad data silently.
7. **REPORT** — "Download Error Report" (workbook listing invalid/duplicate rows + reasons).

## Normalization during import (PRD §48)

- **Insurers** — normalize name variants ("EMPLE", "EMPLE INS", "Emple Insurance") → show **POSSIBLE DUPLICATE MASTER DATA** for admin review; **never auto-merge** (PRD §49).
- **Clients** — same rule as insurers.
- **Risk types** — map to `risk_classes` best match; unknown values listed for admin resolution.
- **Dates** — accept common formats (DD/MM/YYYY, MM/DD/YYYY, text) → ISO date; ambiguous formats flagged.
- **Currency** — parse `₦`/`,`/`$` symbols; store numeric + `currency` column (NGN default, USD detected from header/column).
- **Amounts** — strip commas/symbols; reject negatives unless explicitly a credit-note row; reject "NIL" → NULL (PRD §46).

## Duplicate detection (PRD §32, §48)

Combination keys: policy number + endorsement + client + insurer + transaction date + gross premium. Before save/import: **POSSIBLE DUPLICATE — do you want to continue?**

## Target tables

| Upload targets | Notes |
|---|---|
| `policies` (+collections/remittances) | Income Production / PPS / CRR / Businesses Generated / Form 1C migration |
| `clients` | master |
| `insurers` | master |
| `staff` | personnel migration (incl. second-schedule categories) |
| MANUAL returns | `return_line_items` for ad-hoc/manual-only returns |

## Pre-built mapping templates (from the supplied files, `18`)

- **Income Production / PPS** → `policies`: POLICY NO→policy_number, ENDORSEMENT→endorsement_number, TRANS. TYPE→transaction_type, FROM/TO DATE→cover_from/cover_to, ASSURED→insured_name, CUSTOMER NAME→client_name, BROKERS/AGENT→broker_or_agent, LEDGER ACC.→ledger_account, SUM INSURED→sum_insured, GROSS PREMIUM→gross_premium, BROKERAGE→brokerage_commission, NET PREM→net_premium, DEBIT/CREDIT NOTE NO→debit/credit_note_number, AMOUNT RECEIVED→amount_received, DATE OF RECEIPT→premium_collection_date, RECEIPT NO→receipt_number, INSURER(S)→insurer_name, AMOUNT REMITTED→policy_remittances.
- **CRR** → `policies`: RISK TYPE→risk_type, NAME OF CLIENT→client_name, NAME OF INSURER→insurer_name, APPROVED COMMISSION RATE→commission_rate, TAX PAID→tax, NET COMMISSION RATE→(derived), BROKERAGE COMMISSION→brokerage_commission, OTHER DEDUCTION→other_deductions, NET PREMIUM→net_premium.
- **Businesses Generated** → `policies`: NGN/USD columns resolve by currency.
- **Personnel** → `staff`: NAME OF STAFF→staff_name, STAFF CATEGORY→staff_category (mapped to standard set), DESIGNATION→designation, etc.

## Source-file anomalies the import must handle (from `18`)

- Currency-tagged text amounts (`USD 162944.5997`) → parse numeric + currency.
- Businesses Generated "gross premium ≈ commission" convention → do **not** replicate; map collected/premium correctly and let the reconciliation engine flag mismatches.
- Mixed date formats / impossible dates (`35/6/2026`, `2026-11-02`) → flexible parse + ambiguity flag.
- `NA` / `NIL` sentinels → NULL (PRD §46).
- Insurer/risk variants → normalize + **POSSIBLE DUPLICATE MASTER DATA** review (PRD §49).

## Import-mapping template schema (PRD §47)

```json
{
  "name": "Worldmark CRR Q1 2026",
  "target_table": "policies",
  "mapping": {
    "POLICY NO": "policy_number",
    "NAME OF CUSTOMER": "client_name",
    "NAME OF INSURER": "insurer_name",
    "GROSS PREMIUM": "gross_premium",
    "PREMIUM PAID": "premium_paid_to_insurer",
    "BROKERAGE COMMISSION": "brokerage_commission",
    "DATE": "transaction_date"
  }
}
```

Special mapped fields: `client_name` / `insurer_name` resolve-or-create master rows; `risk_type`/`class_of_business` validated against masters.

## Original-file guarantee (PRD §48)

Uploaded originals are stored untouched in Storage (`imports/original/<file>`); all transformation happens on the parsed copy.
