# 10 — Technical Architecture

## Stack (PRD §3)

| Layer | Choice |
|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript |
| UI | Tailwind CSS, shadcn-style components (Radix primitives), Lucide icons |
| Charts | Recharts |
| Backend | Next.js Route Handlers / Server Actions + service layer |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email/password, password reset) |
| Storage | Supabase Storage (attachments, exports) |
| Excel | SheetJS (`xlsx`) for read/preview + ExcelJS for styled export |
| Hosting | Vercel |
| Testing | Vitest + React Testing Library (unit), Playwright (e2e) |

## High-level architecture

```
┌─────────────────────────┐
│  Browser (phone/laptop) │  responsive PWA-friendly
└────────────┬────────────┘
             │ HTTPS
┌────────────▼──────────────────────────────┐
│  Next.js on Vercel                         │
│  ┌──────────────────────────────────────┐  │
│  │ App Router pages (UI)                │  │
│  │  ┌────────────────────────────────┐  │  │
│  │  │ Service layer (lib/services)    │  │  │
│  │  │  · policies · returns · engine  │  │  │
│  │  │  · validation · reconciliation   │  │  │
│  │  │  · excel · calendar · audit      │  │  │
│  │  └───────────────┬────────────────┘  │  │
│  │  Route Handlers  │  Server Actions   │  │
│  └──────────────────┼───────────────────┘  │
└─────────────────────┼──────────────────────┘
                      │ (Supabase client — anon key + RLS; service-role key SERVER-ONLY)
        ┌─────────────▼─────────────┐
        │  Supabase PostgreSQL      │
        │  · tables/views/triggers  │
        │  · RLS policies           │
        │  · storage buckets        │
        │  · auth                   │
        └───────────────────────────┘
```

## Key principles

- **Server-only secrets.** `SUPABASE_SERVICE_ROLE_KEY` used only inside Route Handlers/Server Actions (never in client bundles). Client uses `SUPABASE_ANON_KEY` with RLS (PRD §35).
- **Centralized data.** Single Supabase project; phone/laptop see the same data through the same API (PRD §4 acceptance).
- **Return engine = data-driven** (`return_templates`), not per-return code (PRD §41).
- **Service layer** isolates business logic from routes so it is unit-testable.

## Project structure (planned)

```
worldmark-naicom-app/
├── .env.example
├── .gitignore
├── README.md  ·  DATABASE.md  ·  RETURN_ENGINE.md  ·  DEPLOYMENT.md  ·  USER_GUIDE.md
├── supabase/
│   ├── migrations/            (numbered .sql)
│   └── seed.sql               (masters + demo data flagged is_demo)
├── src/
│   ├── app/                   (App Router pages, route handlers)
│   ├── components/            (ui/, layouts/, tables/, modals/)
│   ├── lib/
│   │   ├── supabase/          (client + server clients)
│   │   ├── services/          (policies, clients, insurers, staff, returns,
│   │   │                        engine, validation, reconciliation, excel,
│   │   │                        calendar, reminders, audit, import, export)
│   │   ├── types/             (TS types mirroring schema)
│   │   ├── reports/           (report + chart builders)
│   │   └── utils/             (currency, dates, formatting)
│   └── styles/globals.css
├── tests/
│   ├── unit/                  (calculations, periods, validation, duplicates)
│   ├── services/              (engine, import/export)
│   └── e2e/                   (Playwright flows)
└── docs/                      (this deliverable + build docs)
```

## Supabase setup

1. Create project → copy URL + anon key + service-role key into `.env.local`.
2. Run migrations in order (`supabase/migrations`).
3. Run `seed.sql` (masters: company, risk classes, currencies, sample insurers/clients/staff categories).
4. Enable Email (or other) auth provider.
5. Create Storage buckets: `attachments`, `exports`, `imports` (private, RLS-protected).
6. Enable RLS and apply policies from migration files.

## Security checklist (PRD §35)

- HTTPS (Vercel default) · password reset flow · session management
- Role-based access enforced server-side · RLS on every table
- No service-role key in frontend · env vars only, `.env` git-ignored
- Audit log on every important action · soft delete defaults
- Input validation on every mutation (Zod) with user-facing error messages

## Hosting/deployment

- Vercel production + preview deployments.
- `next build` must succeed; env vars documented in `.env.example` (PRD §55).
- Cron for reminders: Vercel Cron `/api/cron/reminders` (protected by CRON_SECRET).
- See `DEPLOYMENT.md` (build docs) for step-by-step.
