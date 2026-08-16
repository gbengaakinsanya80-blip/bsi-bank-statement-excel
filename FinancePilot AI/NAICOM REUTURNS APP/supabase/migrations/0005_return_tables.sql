-- ============================================================
-- 0005_return_tables.sql — Phase 2: Return Engine schema
-- Tables 13–18 (schema doc 03): return_definitions,
-- return_templates, returns, return_versions, return_line_items,
-- adjustments. Plus RLS policies, audit triggers and a unique
-- one-instance-per-period guard.
-- ============================================================

-- ------------------------------------------------------------
-- 13. return_definitions — Regulatory Returns Catalogue
-- ------------------------------------------------------------
create table public.return_definitions (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  code                   text not null unique,
  form_number            text,
  frequency              text not null check (frequency in ('MONTHLY','QUARTERLY','HALF_YEARLY','ANNUAL','AD_HOC')),
  responsible_department text,
  data_source            text,
  template_id            uuid references public.return_templates (id),
  active                 boolean not null default true,
  requires_confirmation  boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 14. return_templates — Return Template Engine (data-driven)
-- JSON columns: columns, calculations, validation_rules,
-- export_format are validated by app code.
-- ------------------------------------------------------------
create table public.return_templates (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  code             text not null unique,
  frequency        text not null check (frequency in ('MONTHLY','QUARTERLY','HALF_YEARLY','ANNUAL','AD_HOC')),
  source           text not null,
  columns          jsonb not null default '[]'::jsonb,
  calculations     jsonb not null default '[]'::jsonb,
  validation_rules jsonb not null default '[]'::jsonb,
  export_format    jsonb not null default '{}'::jsonb,
  due_rule_id      uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 15. returns — Return INSTANCES (one per definition × period)
-- ------------------------------------------------------------
create table public.returns (
  id                   uuid primary key default gen_random_uuid(),
  definition_id        uuid not null references public.return_definitions (id),
  period_label         text not null,
  period_start         date not null,
  period_end           date not null,
  due_date             date,
  status               text not null default 'DRAFT' check (status in ('DRAFT','IN_PROGRESS','READY_FOR_REVIEW','REVIEWED','APPROVED','EXPORTED','SUBMITTED','ACKNOWLEDGED','CLOSED','OVERDUE','NOT_APPLICABLE')),
  responsible_user_id  uuid references public.users (id),
  reviewer_id          uuid references public.users (id),
  data_quality_score   numeric(5,2) check (data_quality_score between 0 and 100),
  submission_date      date,
  submission_reference text,
  submission_method    text,
  submitted_by         uuid references public.users (id),
  approved_by          uuid references public.users (id),
  approval_date        timestamptz,
  notes                text,
  created_by           uuid references public.users (id),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create unique index returns_period_unique on public.returns (definition_id, period_start, period_end);
create index on public.returns (status);
create index on public.returns (due_date);
create index on public.returns (period_start, period_end);

-- ------------------------------------------------------------
-- 16. return_versions — version control (PRD §26)
-- ------------------------------------------------------------
create table public.return_versions (
  id               uuid primary key default gen_random_uuid(),
  return_id        uuid not null references public.returns (id),
  version_no       int not null check (version_no >= 1),
  status           text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','AMENDED','SUPERSEDED')),
  snapshot         jsonb,
  amendment_reason text,
  created_by       uuid references public.users (id),
  approved_by      uuid references public.users (id),
  approval_date    timestamptz,
  created_at       timestamptz not null default now(),
  unique (return_id, version_no)
);

-- ------------------------------------------------------------
-- 17. return_line_items — rows of a return
-- Generated rows carry full column set in row_data; manual /
-- adjusted rows may reference their source policy.
-- ------------------------------------------------------------
create table public.return_line_items (
  id                  uuid primary key default gen_random_uuid(),
  return_id           uuid not null references public.returns (id),
  version_id          uuid references public.return_versions (id),
  source_policy_id    uuid references public.policies (id),
  row_data            jsonb not null default '{}'::jsonb,
  adjustment_reason   text,
  adjusted_by         uuid references public.users (id),
  adjusted_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index on public.return_line_items (return_id);
create index on public.return_line_items (version_id);

-- ------------------------------------------------------------
-- 18. adjustments — auditable manual adjustments (PRD §16)
-- ------------------------------------------------------------
create table public.adjustments (
  id                   uuid primary key default gen_random_uuid(),
  return_id            uuid not null references public.returns (id),
  return_line_item_id  uuid references public.return_line_items (id),
  field                text not null,
  old_value            jsonb,
  new_value            jsonb,
  reason               text not null,
  user_id              uuid references public.users (id),
  created_at           timestamptz not null default now()
);
create index on public.adjustments (return_id);

-- ============================================================
-- RLS
-- ============================================================
alter table public.return_definitions enable row level security;
create policy "return_defs_read_auth"  on public.return_definitions for select to authenticated using (true);
create policy "return_defs_write_admin" on public.return_definitions for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.return_templates enable row level security;
create policy "return_tpls_read_auth"  on public.return_templates for select to authenticated using (true);
create policy "return_tpls_write_admin" on public.return_templates for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.returns enable row level security;
create policy "returns_read_auth" on public.returns for select to authenticated using (true);
create policy "returns_write_workflow" on public.returns for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER'));

alter table public.return_versions enable row level security;
create policy "return_versions_read_auth" on public.return_versions for select to authenticated using (true);
create policy "return_versions_write_workflow" on public.return_versions for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER'));

alter table public.return_line_items enable row level security;
create policy "return_lines_read_auth" on public.return_line_items for select to authenticated using (true);
create policy "return_lines_write_workflow" on public.return_line_items for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER'));

alter table public.adjustments enable row level security;
create policy "adjustments_read_auth" on public.adjustments for select to authenticated using (true);
create policy "adjustments_write_finance" on public.adjustments for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','REVIEWER'));

-- ============================================================
-- Triggers: updated_at + audit trail for return records
-- ============================================================
drop trigger if exists touch_return_definitions_updated_at on public.return_definitions;
create trigger touch_return_definitions_updated_at before update on public.return_definitions for each row execute function public.set_updated_at();

drop trigger if exists touch_return_templates_updated_at on public.return_templates;
create trigger touch_return_templates_updated_at before update on public.return_templates for each row execute function public.set_updated_at();

drop trigger if exists touch_returns_updated_at on public.returns;
create trigger touch_returns_updated_at before update on public.returns for each row execute function public.set_updated_at();

drop trigger if exists audit_returns on public.returns;
create trigger audit_returns after insert or update or delete on public.returns for each row execute function public.audit_write();

drop trigger if exists audit_return_versions on public.return_versions;
create trigger audit_return_versions after insert or update or delete on public.return_versions for each row execute function public.audit_write();
