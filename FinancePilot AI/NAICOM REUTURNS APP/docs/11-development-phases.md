# 11 — Development Phases

Build order per PRD §50 (six phases), expanded into workable units. Each phase ends with a runnable build and lint/typecheck/tests green.

## Phase 1 — Foundation
- Scaffold Next.js + TS + Tailwind + shadcn-style UI kit.
- Supabase project + migrations (tables 1–12, 24, 26–28, 32 from `03-database-schema.md`).
- Supabase Auth + roles + RLS policies + audit triggers.
- Seed masters: company (WORLDMARK), risk classes, currencies, sample clients/insurers, demo data (`is_demo=true`).
- Services: clients, insurers, risk classes, policies (+collections/remittances), staff.
- Basic dashboard with KPI cards + business statistics.
- **Exit criteria:** login → add a policy → dashboard reflects it; lint/typecheck/tests pass.

## Phase 2 — Core Returns ✅ DONE
- Return engine service (template-driven) + `return_templates` seed for the 6 core returns.
- Income Production, PPS, CRR, Businesses Generated, Personnel Returns, Form 1C, Brokerage Commission Register (annual) builders + auto totals.
- Return instances, versions (`return_versions` + snapshot on each generate), line items, adjustments.
- Status workflow DRAFT → READY_FOR_REVIEW → APPROVED (guarded server-side + UI actions).
- Excel (.xlsx) export — zero-dependency OOXML writer; live mode reads `return_templates.export_format`/`columns`.
- Migrations `0005_return_tables.sql` + `0006_return_views.sql`; seed return templates/definitions.
- **Exit criteria:** generate each of the 6 returns from entered policy data with correct figures; ✅ verified in preview (demo) mode.

## Phase 3 — Compliance ✅ DONE
- Regulatory Calendar engine + due-date rules.
- Return workflow state machine (DRAFT → … → CLOSED, PRD §40).
- Validation engine + data-quality score.
- Cross-return reconciliation + drill-down.
- In-app notifications.
- **Exit criteria:** calendar shows RED/ORANGE/YELLOW/GREEN; validation blocks READY_FOR_REVIEW on errors; reconciliation flags differences.

## Phase 4 — Import / Export ✅ DONE
- Excel import wizard (**upload → read → preview → map → validate → import → error report**, PRD §24) at `/import`: zero-dependency xlsx reader (zip + shared/inline strings + date serials), header-row auto-detection (skips title blocks), NAICOM header auto-mapping, per-row normalization/validation + duplicate detection, file-backed import sessions, error-report workbook download (`/api/import/[id]/report`).
- Reusable import mapping templates (`POLICY_FIELDS` + `AUTO_MAP` in `src/lib/import/mapping.ts`).
- Excel export (Worldmark/NAICOM format: headers, order, formatting, totals, NGN/USD) + CSV + PDF + Print — export shipped in Phase 2/3; import completed in this phase.
- Attachments (Supabase Storage) — pending live-mode wiring.
- **Exit criteria:** ✅ import an Excel workbook end-to-end in preview mode (valid rows persisted to the demo policy store and feeding the returns engine); export each return resembles the Worldmark file layout.

## Phase 5 — Management ✅ DONE
- Management dashboard charts (Recharts) at `/reports/management`: monthly premium/collected/paid/commission trend, gross premium by insurer/risk class/client, top clients by commission.
- Report builder at `/reports/builder` with date/client/insurer/risk/currency filters → Excel/CSV export (`/api/reports/export`).
- Premium report at `/reports/premium` (collections, remittances, outstanding) + monthly summary.
- Commission report at `/reports/commission` (by risk class / insurer / client).
- Compliance report at `/reports/compliance` (calendar-driven status, due dates, days left).
- Master-data CRUD: add/edit/delete clients, insurers and staff from the UI (`/clients/new`, `/insurers/new`, `/staff/new` + per-record edit/delete). Works in preview mode via a local demo store (merged with built-in demo records) and against Supabase in live mode. Newly added clients/insurers appear in the New Policy dropdowns.
- Global search (sidebar + mobile topbar) at `/search` — policies, clients, insurers, staff, returns (PRD §29).
- **Exit criteria:** ✅ executive charts render; reports export to Excel/CSV; masters editable end-to-end in preview mode.

## Phase 6 — Advanced Automation
- Email reminders (30/14/7/3/1 day, due date, daily overdue) via cron + notification preferences.
- WhatsApp/SMS **only if configured** — otherwise surface "Integration not configured."
- Regulatory update system (source register maintained by admins).
- NAICOM API integration hook reserved for future (PRD §27, §51).
- **Exit criteria:** reminders fire without duplicates; disabled channels show "Integration not configured."

## Testing throughout
Unit + service + e2e tests land with each phase (see `12-testing-strategy.md`). Mobile manual testing at 360/390/430/768/1024/1440+ (PRD §52).

## Post-approval kickoff order
1. Repo init (`.gitignore`, `.env.example`, README skeleton, git init) — PRD §56.
2. Supabase migrations + seed.
3. Phase 1 code.
