# 17 — Data Migration Strategy

Migrate existing Worldmark Excel data into the master tables (PRD §48). Original files are **never modified**.

## Source files & targets

| Worldmark file | Migrate to | Status |
|---|---|---|
| `2026 JUNE INCOME PRODUCTION.xlsx` | `policies` (+ collections/remittances) | Parsed — `18` §1 |
| `2026 JUNE INCOME PRODUCTION - Copy - Copy.xlsx` | — (duplicate of above) | Ignore |
| `PPS.xlsx.csv` (xlsx binary) | `policies` (+ collections/remittances) | Parsed — PPS-A layout, `18` §2 |
| `PPS.xlsx (2).csv` | — (duplicate) | Ignore |
| `2026 CRR FOR FIRST QUARTER.xlsx` | `policies` | Parsed — `18` §3 |
| `2022 FIRST QUARTER CRR.xlsx` | `policies` (historical) | Parsed — `18` §3 |
| `2026 BUSINESSES GENERATED FIRST HALF YEAR.xlsx` | `policies` | Parsed — `18` §4 (normalize gross≈commission anomaly) |
| `2026 SECOND QUARTER PERSONNEL RETURNS.xlsx` | `staff` | Parsed — two schedules, `18` §5 |
| `2025 form 1c (1).xlsx` | reference only (derived return) | **File not supplied** — pending |

## Process

1. **Copy** source file to Storage `imports/original/` (canonical file only — skip `- Copy - Copy` and `(2)` duplicates).
2. **Parse** via import pipeline (map columns → normalize → validate → preview). File type sniffed by content (PPS files are xlsx renamed to `.csv`).
3. **Normalize** (PRD §48): duplicate detection · insurer/client name normalization (EMPLE / EMPLE INS / EMPLE INSURANCE) · risk-type mapping (GLA, MV, apg → risk_classes) · staff-category mapping to standard set (JUNIOR/SENIOR STAFF, LOWER/SENIOR MANAGEMENT) · date/currency/amount normalization (incl. `USD 162944.5997` and `12..5` cases).
4. **Master resolution**: `insurer_name`/`client_name` resolve-or-create in `insurers`/`clients`; near-matches shown as **POSSIBLE DUPLICATE MASTER DATA** for admin confirmation (never auto-merge, PRD §49).
5. **Import valid rows** into `policies` / `staff`; invalid rows → downloadable error report.
6. **Audit**: an `audit_logs` IMPORT record per job with job id + counts.

## Rules

- **No duplicates** imported: combination-key check (policy no. + client + insurer + date + premium).
- **Historical periods preserved**: imported policies carry their original `transaction_date`, so monthly/quarterly/half-year returns regenerate correctly for past periods.
- **Never overwrite** previously generated/submitted returns; import only creates new underlying data, which new return instances consume (PRD §15 §26).
- **Demo vs real**: migrated Worldmark data is `is_demo=false`; seed/demo records are `is_demo=true` and separated (PRD §53).
- Import runs in the admin UI (`/import`) with full preview before commit.

## Undo/recovery

- Each job records exact row set + target; an admin can revert a job (marks rows `deleted_at`) with audit.
- Backups via "Export All Data" (see `03-database-schema.md` §31 + Settings/Backup) before large migrations.
