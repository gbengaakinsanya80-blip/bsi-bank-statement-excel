# Worldmark Regulatory Hub

NAICOM returns management system for **WORLDMARK INSURANCE BROKERS LTD**.
Enter business data once, generate every NAICOM return from it.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and Supabase
(PostgreSQL + Auth + RLS). Design package: see `docs/00-README.md`.

## Stack

| Layer    | Choice |
|----------|--------|
| Frontend | Next.js 15 + React 19 + TypeScript |
| UI       | Tailwind CSS, shadcn-style components, Lucide icons |
| Backend  | Route Handlers / Server Actions + service layer |
| DB/Auth  | Supabase (PostgreSQL, Auth, Storage, RLS) |
| Hosting  | Vercel |

## Getting started

1. Create a Supabase project at https://supabase.com and copy its URL + anon key + service-role key.
2. Copy `.env.example` → `.env.local` and fill in the values:

   ```
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_ANON_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   CRON_SECRET=
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is server-only and never bundled to the browser.
3. Apply the schema. Either run the migration files in `supabase/migrations/`
   in order (via the Supabase dashboard SQL editor or the Supabase CLI), then
   run `supabase/seed.sql`, or:
   ```
   supabase link --project-ref <ref>
   supabase db push
   supabase db reset
   ```
4. Enable the **Email** auth provider (Authentication → Providers) if you want
   email confirmations. With confirmations disabled, sign-up logs you straight in.
5. Run the app:
   ```
   npm install
   npm run dev
   ```
6. Register the first account — it automatically becomes **SUPER_ADMIN**
   (see `supabase/migrations/0001_core_tables.sql`).

## Preview mode (no Supabase needed)

If `NEXT_PUBLIC_SUPABASE_URL` is not set, the app runs in **preview mode**:
the full UI renders with realistic sample data (clearly badged `PREVIEW`,
saving disabled). Any email/password signs you in.

```
npm run dev
# open http://localhost:3000, sign in with anything
```

## First login checklist (Phase 1 exit criteria)

- [ ] Sign up / sign in
- [ ] Dashboard shows zeroed KPI cards
- [ ] Add a policy (Policies → New policy)
- [ ] Dashboard reflects the new policy (counts + premium + recent list)

## Scripts

| Command            | Purpose                    |
|--------------------|----------------------------|
| `npm run dev`      | Dev server on :3000        |
| `npm run build`    | Production build           |
| `npm run start`    | Serve production build     |
| `npm run lint`     | ESLint                     |

## Database

- Schema source of truth: `docs/03-database-schema.md`.
- Migrations in `supabase/migrations/` (numbered, idempotent).
- Seed (masters + demo data flagged `is_demo = true`) in `supabase/seed.sql`.
- Demo data is excluded from all dashboard KPI views.
