# 12 — Testing Strategy

PRD §52 requires automated tests + manual mobile testing.

## Test pyramid

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest | calculations, date/period logic, validation, formatting, duplicate detection |
| Service | Vitest (mocked Supabase / integration vs local PG) | engine, returns, import/export, calendar, permissions |
| Component | React Testing Library | forms, tables, modals, validation messages |
| E2E | Playwright | login, CRUD flows, return workflow, import/export, dashboard |
| Mobile manual | Device/browser devtools | 360/390/430/768/1024/1440+ |

## Unit test matrix

| Area | Cases |
|---|---|
| Commission | Gross × Rate; override preservation; flag-on-mismatch |
| Net Premium | Gross − Commission − Other Deduction |
| Premium logic | Collected ≤ expected flags; Paid > Collected flags |
| Date periods | Monthly/Q/H1/FY boundaries, leap years, fiscal-year start |
| Quarterly/Half/Annual periods | Q1–Q4, H1/H2, full-year derivation |
| Validation | Missing policy/client/insurer/risk/premium; negative amounts; invalid dates; "12..5" percentage; comma-formatted numbers; currency symbols; "NIL"/blank |
| Duplicate detection | Same policy+client+insurer+date+premium → warning; distinct → pass |
| Deadline calculation | Due-date rules, days-remaining, RED/ORANGE/YELLOW/GREEN buckets |
| Reconciliation | Sum equality + difference messages |
| Excel export | Header order, formats, totals, NGN/USD, NULL→"NIL"/blank output |
| Excel import | Row counts (total/valid/invalid/duplicate), column mapping, error report |
| Permissions | Each role × action matrix (from `07`) |
| Versioning | Version 1 submitted; amendment → version 2; history intact |

## Manual mobile checklist
- Bottom navigation reaches all sections; large touch targets; floating Quick Add.
- Add a business on phone → visible on laptop (same account) — acceptance criterion (PRD §58).
- Forms scroll/resize without overflow at 360–430px; tables swipe-friendly; dashboard cards stack.
- Offline/bad-network error states degrade gracefully.

## Definition of done per feature
- Unit tests for logic · lint + typecheck clean · build succeeds · manual smoke on ≥2 viewport sizes · export verified against Worldmark format sample when available.
