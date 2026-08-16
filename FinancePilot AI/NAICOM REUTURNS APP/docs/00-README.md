# WORLDMARK REGULATORY HUB — First Deliverable

**WORLDMARK NAICOM RETURNS MANAGEMENT SYSTEM**

This folder contains the complete design package produced from `PRD.dm.txt` (Section 60 — First Deliverable), plus the approved **Phase 1 implementation**.

## Status

| Item | Status |
|------|--------|
| Design from PRD text | DONE |
| Design from actual Worldmark Excel files | DONE — see `18-excel-file-analysis.md` |
| Form 1C template (`2025 form 1c (1).xlsx`) | MISSING — design per PRD §16; exact layout pending file |
| Approval gate | APPROVED — Phase 1 started |
| Phase 1 — Foundation (code) | **DONE** — scaffold + migrations + RLS + seed + services + dashboard; lint/typecheck/tests/build green |
| Phase 1 live verification | PENDING — requires a Supabase project (`.env.local`) to run migrations + `seed.sql` |
| Phase 2 — Core Returns (code) | **DONE** — return engine (templates), 6 builders with auto totals, instances, versions, status workflow (DRAFT→READY_FOR_REVIEW→APPROVED), Excel (.xlsx) export; lint/typecheck/tests/build green |
| Phase 2 live verification | PENDING — requires a Supabase project to run migrations `0005`/`0006` + `seed.sql` return templates/definitions |

> Phase 1/2 note: `npm run build`, `npm run lint`, `npm run typecheck` and `npm run test`
> all pass. Without a Supabase project configured the app renders a setup notice
> instead of failing. Setup steps: `README.md`.

## Deliverable index

| # | Document | Purpose |
|---|----------|---------|
| 01 | `01-data-dictionary.md` | Every field/column across the system, its table, type, source return(s) |
| 02 | `02-er-diagram.md` | Entity–relationship diagram (Mermaid) + table relationships |
| 03 | `03-database-schema.md` | Complete normalized database schema (all tables, columns, types, indexes) |
| 04 | `04-return-catalogue.md` | The configurable Regulatory Returns Catalogue (all NAICOM returns) |
| 05 | `05-return-frequency-matrix.md` | Every return mapped to its frequency and reporting period |
| 06 | `06-return-to-database-mapping.md` | Which database tables/fields feed each return |
| 07 | `07-roles-permissions-matrix.md` | User roles → module access → actions matrix |
| 08 | `08-application-sitemap.md` | Desktop sidebar + mobile navigation structure |
| 09 | `09-ui-screen-list.md` | Complete UI screen inventory |
| 10 | `10-technical-architecture.md` | Stack, hosting, Supabase setup, security, deployment model |
| 11 | `11-development-phases.md` | Phase 1–6 roadmap from the PRD, expanded into build units |
| 12 | `12-testing-strategy.md` | Automated + manual + mobile test plan |
| 13 | `13-excel-import-strategy.md` | Upload → read → preview → map → validate → import pipeline |
| 14 | `14-excel-export-strategy.md` | Worldmark/NAICOM-format export rules |
| 15 | `15-regulatory-deadline-strategy.md` | Configurable due-date/calendar/reminder engine |
| 16 | `16-validation-reconciliation-strategy.md` | Data validation engine + cross-return reconciliation |
| 17 | `17-data-migration-strategy.md` | Migration of the existing Worldmark Excel data |
| 18 | `18-excel-file-analysis.md` | Parsed column layouts + data-quality findings from the supplied Worldmark files |

## Design principles applied

1. **ENTER ONCE → USE MANY TIMES.** One `policies` transaction record feeds every return via reporting queries — no data duplication.
2. **Master data hierarchy (PRD §44):** Master Data → Business Transactions → Accounting/Reconciliation → Regulatory Reporting Engine → NAICOM Returns.
3. **Return templates, not hard-coded returns (PRD §41).** New NAICOM returns are configured by an administrator, not coded.
4. **Configurable deadlines (PRD §42).** No hard-coded regulatory dates; deadlines live in `due_date_rules` and default to *"Deadline requires confirmation."* where NAICOM has not supplied them.
5. **Never destroy history (PRD §26/§27).** Return versioning + submission tracking + soft delete + audit log.
6. **No fake functionality (PRD §51).** Anything requiring an unavailable external API is surfaced as *"Integration not configured."*
7. **NULL, not "NIL" (PRD §45/§46).** Spreadsheet "NIL"/blank values are stored as database NULL and rendered correctly only at export time.

## Key decisions made in this deliverable

- **Central fact table is `policies`** (master business transaction). Collections and remittances are child tables so a policy can have multiple receipts/remittances (normalized).
- **`returns` (instances) are versioned.** `return_versions` holds the frozen snapshot for each submitted/amended version (PRD §26).
- **`return_templates` drive the reporting engine** — columns, sources, calculations, validation rules and export format are data, not code.
- **Adjustments to generated returns are stored separately** with reason/user/date/audit (PRD §16 — Form 1C manual adjustment rule generalised).
- **Staff Master is permanent.** Quarterly personnel returns are generated from `staff`, preserving history (PRD §15).
- **Demo data flagged `is_demo = true`** and never mixed with real records (PRD §53).

## Open questions awaiting the Worldmark Excel files

1. ~~Exact column headers / order of `2026 JUNE INCOME PRODUCTION.xlsx`~~ → **RESOLVED** (see 18; export uses clean PPS-style headers).
2. ~~Meaning of `PPS.xlsx.csv`~~ → **RESOLVED**: PPS = PREMIUM INCOME/PRODUCTION SCHEDULE (NAICOM Form **PPS-A**), **Monthly**, 30-column NAICOM layout. Note: the `.csv` files are actually xlsx binaries — import must sniff by content.
3. ~~Layout of `2026 CRR FOR FIRST QUARTER.xlsx`~~ → **RESOLVED** (16 columns; confirmed PRD §13).
4. ~~Layout of `2026 BUSINESSES GENERATED...xlsx`~~ → **RESOLVED** (15 columns, NGN/USD split; source contains inconsistent gross≈commission — flagged for reconciliation).
5. ~~`2026 SECOND QUARTER PERSONNEL RETURNS.xlsx`~~ → **RESOLVED** (two schedules: Statement of Personnel + Summary of Personnel Changes).
6. `2025 form 1c (1).xlsx` → **NOT SUPPLIED** — exact Form 1C layout pending.

The schema is unaffected by these resolutions (it was designed around the underlying entities); they refine return templates, export layouts, and migration targets.
