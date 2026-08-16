-- ============================================================
-- 0007_compliance_tables.sql — Phase 3: Compliance schema
-- Tables 19–23 + 29–30 (schema doc 03): due_date_rules,
-- regulatory_calendar, reminders, user_notifications,
-- notification_preferences, reconciliation_rules,
-- reconciliation_results. Plus RLS, audit triggers.
-- ============================================================

-- ------------------------------------------------------------
-- 19. due_date_rules — configurable NAICOM deadlines (PRD §42)
-- ------------------------------------------------------------
create table public.due_date_rules (
  id             uuid primary key default gen_random_uuid(),
  definition_id  uuid not null references public.return_definitions (id),
  rule           jsonb not null default '{}'::jsonb,
  effective_from date not null,
  effective_to   date,
  confirmed      boolean not null default false,
  source         text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index on public.due_date_rules (definition_id);

-- ------------------------------------------------------------
-- 20. regulatory_calendar — materialised due items (PRD §19)
-- ------------------------------------------------------------
create table public.regulatory_calendar (
  id                 uuid primary key default gen_random_uuid(),
  definition_id      uuid not null references public.return_definitions (id),
  return_id          uuid references public.returns (id),
  period_label       text not null,
  period_start       date not null,
  period_end         date not null,
  due_date           date,
  status             text not null default 'NOT_STARTED'
                     check (status in ('NOT_STARTED','IN_PROGRESS','READY_FOR_REVIEW','APPROVED','SUBMITTED','OVERDUE','NOT_APPLICABLE')),
  responsible_user_id uuid references public.users (id),
  department         text,
  created_at         timestamptz not null default now(),
  unique (definition_id, period_start, period_end)
);
create index on public.regulatory_calendar (status);
create index on public.regulatory_calendar (due_date);

-- ------------------------------------------------------------
-- 21. reminders — idempotent reminder log (PRD §20)
-- ------------------------------------------------------------
create table public.reminders (
  id           uuid primary key default gen_random_uuid(),
  calendar_id  uuid not null references public.regulatory_calendar (id),
  channel      text not null check (channel in ('IN_APP','EMAIL','WHATSAPP','SMS')),
  lead_days    int not null,
  scheduled_for timestamptz,
  status       text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED','SKIPPED')),
  sent_at      timestamptz,
  error        text,
  created_at   timestamptz not null default now(),
  unique (calendar_id, channel, lead_days)
);
create index on public.reminders (status);

-- ------------------------------------------------------------
-- 22. user_notifications — in-app notification inbox
-- ------------------------------------------------------------
create table public.user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id),
  title      text not null,
  body       text,
  type       text not null check (type in ('DEADLINE','VALIDATION','WORKFLOW','SYSTEM')),
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.user_notifications (user_id, read);
create index on public.user_notifications (created_at);

-- ------------------------------------------------------------
-- 23. notification_preferences — per-user channel settings
-- ------------------------------------------------------------
create table public.notification_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users (id),
  channel    text not null check (channel in ('IN_APP','EMAIL','WHATSAPP','SMS')),
  enabled    boolean not null default true,
  lead_days  jsonb not null default '[30,14,7,3,1,0]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, channel)
);

-- ------------------------------------------------------------
-- 29. reconciliation_rules — pre-configured cross-return checks
-- ------------------------------------------------------------
create table public.reconciliation_rules (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  source_a   jsonb not null default '{}'::jsonb,
  source_b   jsonb not null default '{}'::jsonb,
  threshold  numeric not null default 0.01,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 30. reconciliation_results — stored outcomes + drill-down
-- ------------------------------------------------------------
create table public.reconciliation_results (
  id              uuid primary key default gen_random_uuid(),
  rule_id         uuid not null references public.reconciliation_rules (id),
  return_a_id     uuid references public.returns (id),
  return_b_id     uuid references public.returns (id),
  value_a         numeric,
  value_b         numeric,
  difference      numeric,
  status          text not null check (status in ('OK','WARNING')),
  resolved        boolean not null default false,
  investigated_by uuid references public.users (id),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on public.reconciliation_results (rule_id);
create index on public.reconciliation_results (status);

-- ============================================================
-- RLS
-- ============================================================
alter table public.due_date_rules enable row level security;
create policy "due_rules_read_auth"  on public.due_date_rules for select to authenticated using (true);
create policy "due_rules_write_admin" on public.due_date_rules for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.regulatory_calendar enable row level security;
create policy "calendar_read_auth"  on public.regulatory_calendar for select to authenticated using (true);
create policy "calendar_write_admin" on public.regulatory_calendar for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER'));

alter table public.reminders enable row level security;
create policy "reminders_read_auth"  on public.reminders for select to authenticated using (true);
create policy "reminders_write_admin" on public.reminders for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.user_notifications enable row level security;
create policy "notifications_read_own"  on public.user_notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications_write_own" on public.user_notifications for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.notification_preferences enable row level security;
create policy "notif_prefs_read_own"  on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
create policy "notif_prefs_write_own" on public.notification_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.reconciliation_rules enable row level security;
create policy "recon_rules_read_auth"  on public.reconciliation_rules for select to authenticated using (true);
create policy "recon_rules_write_admin" on public.reconciliation_rules for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.reconciliation_results enable row level security;
create policy "recon_results_read_auth"  on public.reconciliation_results for select to authenticated using (true);
create policy "recon_results_write_finance" on public.reconciliation_results for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','REVIEWER'));

-- ============================================================
-- Triggers: updated_at + audit trail
-- ============================================================
drop trigger if exists touch_due_date_rules_updated_at on public.due_date_rules;
create trigger touch_due_date_rules_updated_at before update on public.due_date_rules for each row execute function public.set_updated_at();

drop trigger if exists touch_notification_preferences_updated_at on public.notification_preferences;
create trigger touch_notification_preferences_updated_at before update on public.notification_preferences for each row execute function public.set_updated_at();

drop trigger if exists touch_reconciliation_results_updated_at on public.reconciliation_results;
create trigger touch_reconciliation_results_updated_at before update on public.reconciliation_results for each row execute function public.set_updated_at();

drop trigger if exists audit_regulatory_calendar on public.regulatory_calendar;
create trigger audit_regulatory_calendar after insert or update or delete on public.regulatory_calendar for each row execute function public.audit_write();

drop trigger if exists audit_reconciliation_results on public.reconciliation_results;
create trigger audit_reconciliation_results after insert or update or delete on public.reconciliation_results for each row execute function public.audit_write();
