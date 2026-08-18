-- ============================================================
-- FULL MIGRATION + SEED SCRIPT
-- Run this ONCE in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 0001_core_tables.sql
-- ============================================================
create extension if not exists pgcrypto;

create table public.company (
  id                     uuid primary key default gen_random_uuid(),
  company_name           text not null default 'WORLDMARK INSURANCE BROKERS LTD',
  registration_number    text,
  naicom_number          text,
  address                text,
  phone                  text,
  email                  text,
  reporting_contact      text,
  logo_url               text,
  default_currency       char(3) not null default 'NGN',
  financial_year_start_month smallint not null default 1 check (financial_year_start_month between 1 and 12),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text,
  email       text unique not null,
  phone       text,
  role        text not null default 'VIEWER' check (role in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','HR','REVIEWER','VIEWER')),
  department  text,
  active      boolean not null default true,
  last_login  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    case when not exists (select 1 from public.users) then 'SUPER_ADMIN' else 'VIEWER' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.audit_logs (
  id         bigserial primary key,
  user_id    uuid references public.users (id) on delete set null,
  action     text not null check (action in ('CREATE','UPDATE','DELETE','EXPORT','IMPORT','APPROVE','SUBMIT','REOPEN','LOGIN')),
  module     text not null,
  record_id  text,
  old_value  jsonb,
  new_value  jsonb,
  ip_address text,
  device     text,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (module, record_id);
create index on public.audit_logs (created_at desc);

create table public.clients (
  id            uuid primary key default gen_random_uuid(),
  client_name   text not null,
  address       text,
  phone         text,
  email         text,
  contact_person text,
  industry      text,
  status        text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE','SUSPENDED')),
  is_demo       boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.clients (lower(client_name));

create table public.insurers (
  id            uuid primary key default gen_random_uuid(),
  insurer_name  text not null,
  naicom_code   text,
  address       text,
  contact       text,
  email         text,
  active        boolean not null default true,
  is_demo       boolean not null default false,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.insurers (lower(insurer_name));

create table public.risk_classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  code       text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

create table public.staff (
  id                          uuid primary key default gen_random_uuid(),
  staff_name                  text not null,
  staff_category_id           uuid references public.staff_categories (id),
  designation                 text,
  gender                      text check (gender in ('MALE','FEMALE')),
  educational_qualification   text,
  professional_qualification  text,
  date_of_employment          date,
  state_of_origin             text,
  location                    text,
  date_of_exit                date,
  reason_for_leaving          text,
  is_demo                     boolean not null default false,
  deleted_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index on public.staff (lower(staff_name));

create table public.currencies (
  code           char(3) primary key,
  name           text,
  symbol         text,
  decimal_places smallint not null default 2,
  is_base        boolean not null default false
);

create table public.policies (
  id                      uuid primary key default gen_random_uuid(),
  transaction_reference   text,
  policy_number           text,
  endorsement_number      text,
  transaction_type        text not null default 'NEW' check (transaction_type in ('NEW','RENEWAL','ENDORSEMENT','DEBIT_NOTE','CREDIT_NOTE','CANCELLATION')),
  new_or_renewal          text check (new_or_renewal in ('NEW','RENEWAL')),
  risk_type               text,
  class_of_business       text,
  client_id               uuid references public.clients (id),
  insured_name            text,
  insurer_id              uuid references public.insurers (id),
  broker_or_agent         text,
  ledger_account          text,
  sum_insured             numeric(20,2) check (sum_insured >= 0),
  currency                char(3) not null default 'NGN' references public.currencies (code),
  gross_premium           numeric(20,2) check (gross_premium >= 0),
  premium_collected       numeric(20,2) check (premium_collected >= 0),
  premium_paid_to_insurer numeric(20,2) check (premium_paid_to_insurer >= 0),
  brokerage_commission    numeric(20,2) check (brokerage_commission >= 0),
  commission_rate         numeric(6,2) check (commission_rate >= 0),
  tax                     numeric(20,2) check (tax >= 0),
  other_deductions        numeric(20,2) check (other_deductions >= 0),
  net_premium             numeric(20,2) check (net_premium >= 0),
  amount_received         numeric(20,2) check (amount_received >= 0),
  receipt_number          text,
  debit_note_number       text,
  credit_note_number      text,
  transaction_date        date,
  cover_from              date,
  cover_to                date,
  premium_collection_date date,
  premium_payment_date    date,
  branch_location         text,
  remarks                 text,
  status                  text not null default 'ACTIVE' check (status in ('ACTIVE','ARCHIVED')),
  is_demo                 boolean not null default false,
  created_by              uuid references public.users (id),
  deleted_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index on public.policies (policy_number);
create index on public.policies (transaction_date);
create index on public.policies (client_id);
create index on public.policies (insurer_id);
create index on public.policies (risk_type);
create index on public.policies (transaction_type);
create index on public.policies (currency, transaction_date);

create unique index policies_duplicate_guard
  on public.policies (policy_number, coalesce(endorsement_number, ''), client_id, insurer_id, transaction_date, gross_premium)
  where deleted_at is null and policy_number is not null;

create table public.policy_collections (
  id              uuid primary key default gen_random_uuid(),
  policy_id       uuid not null references public.policies (id),
  amount          numeric(20,2) not null check (amount >= 0),
  currency        char(3) not null default 'NGN' references public.currencies (code),
  collection_date date,
  receipt_number  text,
  payment_method  text check (payment_method in ('CASH','TRANSFER','CHEQUE','POS')),
  bank_name       text,
  cheque_number   text,
  remarks         text,
  created_by      uuid references public.users (id),
  created_at      timestamptz not null default now()
);
create index on public.policy_collections (policy_id);
create index on public.policy_collections (collection_date);

create table public.policy_remittances (
  id          uuid primary key default gen_random_uuid(),
  policy_id   uuid not null references public.policies (id),
  insurer_id  uuid references public.insurers (id),
  amount      numeric(20,2) not null check (amount >= 0),
  currency    char(3) not null default 'NGN' references public.currencies (code),
  payment_date date,
  reference   text,
  remarks     text,
  created_by  uuid references public.users (id),
  created_at  timestamptz not null default now()
);
create index on public.policy_remittances (policy_id);
create index on public.policy_remittances (payment_date);

create table public.attachments (
  id          uuid primary key default gen_random_uuid(),
  module      text not null check (module in ('RETURN','SUBMISSION','POLICY','STAFF','REGULATORY_REF')),
  record_id   uuid,
  file_name   text not null,
  file_path   text not null,
  file_size   bigint,
  mime_type   text,
  uploaded_by uuid references public.users (id),
  created_at  timestamptz not null default now()
);
create index on public.attachments (module, record_id);

create table public.regulatory_references (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  type                text check (type in ('ACT','GUIDELINE','CIRCULAR')),
  return_requirement  text,
  effective_date      date,
  source              text,
  document_url        text,
  last_reviewed_date  date,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.import_jobs (
  id               uuid primary key default gen_random_uuid(),
  file_name        text not null,
  target_table     text not null check (target_table in ('policies','clients','insurers','staff')),
  status           text not null default 'UPLOADED' check (status in ('UPLOADED','PARSED','MAPPED','VALIDATED','IMPORTED','FAILED')),
  total_rows       int,
  valid_rows       int,
  invalid_rows     int,
  duplicate_rows   int,
  error_report_url text,
  created_by       uuid references public.users (id),
  created_at       timestamptz not null default now()
);

create table public.import_mappings (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  target_table text not null check (target_table in ('policies','clients','insurers','staff')),
  mapping      jsonb not null default '{}'::jsonb,
  created_by   uuid references public.users (id),
  created_at   timestamptz not null default now()
);

create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 0002_rls.sql
-- ============================================================
create or replace function public.app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

alter table public.company enable row level security;
create policy "company_read_auth" on public.company for select to authenticated using (true);
create policy "company_write_admin" on public.company for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.users enable row level security;
create policy "users_read_own_or_admin" on public.users for select to authenticated using (id = auth.uid() or public.app_user_role() in ('SUPER_ADMIN','ADMIN'));
create policy "users_write_admin" on public.users for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.audit_logs enable row level security;
create policy "audit_read_admin" on public.audit_logs for select to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.clients enable row level security;
create policy "clients_read_auth" on public.clients for select to authenticated using (true);
create policy "clients_write_ops" on public.clients for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','OPERATIONS'));

alter table public.insurers enable row level security;
create policy "insurers_read_auth" on public.insurers for select to authenticated using (true);
create policy "insurers_write_ops" on public.insurers for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','OPERATIONS'));

alter table public.risk_classes enable row level security;
create policy "risk_classes_read_auth" on public.risk_classes for select to authenticated using (true);
create policy "risk_classes_write_ops" on public.risk_classes for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','OPERATIONS'));

alter table public.staff_categories enable row level security;
create policy "staff_categories_read_auth" on public.staff_categories for select to authenticated using (true);
create policy "staff_categories_write_hr" on public.staff_categories for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR'));

alter table public.staff enable row level security;
create policy "staff_read_auth" on public.staff for select to authenticated using (true);
create policy "staff_write_hr" on public.staff for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR'));

alter table public.policies enable row level security;
create policy "policies_read_auth" on public.policies for select to authenticated using (true);
create policy "policies_write_finance" on public.policies for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.policy_collections enable row level security;
create policy "collections_read_auth" on public.policy_collections for select to authenticated using (true);
create policy "collections_write_finance" on public.policy_collections for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.policy_remittances enable row level security;
create policy "remittances_read_auth" on public.policy_remittances for select to authenticated using (true);
create policy "remittances_write_finance" on public.policy_remittances for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.currencies enable row level security;
create policy "currencies_read_auth" on public.currencies for select to authenticated using (true);
create policy "currencies_write_admin" on public.currencies for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.attachments enable row level security;
create policy "attachments_read_auth" on public.attachments for select to authenticated using (true);
create policy "attachments_write_finance" on public.attachments for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','HR')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','HR'));

alter table public.regulatory_references enable row level security;
create policy "reg_refs_read_auth" on public.regulatory_references for select to authenticated using (true);
create policy "reg_refs_write_admin" on public.regulatory_references for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.import_jobs enable row level security;
create policy "import_jobs_read_auth" on public.import_jobs for select to authenticated using (true);
create policy "import_jobs_write_ops" on public.import_jobs for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.import_mappings enable row level security;
create policy "import_mappings_read_auth" on public.import_mappings for select to authenticated using (true);
create policy "import_mappings_write_ops" on public.import_mappings for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.app_settings enable row level security;
create policy "app_settings_read_admin" on public.app_settings for select to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));
create policy "app_settings_write_admin" on public.app_settings for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

-- ============================================================
-- 0003_triggers.sql
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_company_updated_at on public.company;
create trigger touch_company_updated_at before update on public.company for each row execute function public.set_updated_at();

drop trigger if exists touch_users_updated_at on public.users;
create trigger touch_users_updated_at before update on public.users for each row execute function public.set_updated_at();

drop trigger if exists touch_clients_updated_at on public.clients;
create trigger touch_clients_updated_at before update on public.clients for each row execute function public.set_updated_at();

drop trigger if exists touch_insurers_updated_at on public.insurers;
create trigger touch_insurers_updated_at before update on public.insurers for each row execute function public.set_updated_at();

drop trigger if exists touch_risk_classes_updated_at on public.risk_classes;
create trigger touch_risk_classes_updated_at before update on public.risk_classes for each row execute function public.set_updated_at();

drop trigger if exists touch_staff_updated_at on public.staff;
create trigger touch_staff_updated_at before update on public.staff for each row execute function public.set_updated_at();

drop trigger if exists touch_policies_updated_at on public.policies;
create trigger touch_policies_updated_at before update on public.policies for each row execute function public.set_updated_at();

drop trigger if exists touch_regulatory_references_updated_at on public.regulatory_references;
create trigger touch_regulatory_references_updated_at before update on public.regulatory_references for each row execute function public.set_updated_at();

drop trigger if exists touch_app_settings_updated_at on public.app_settings;
create trigger touch_app_settings_updated_at before update on public.app_settings for each row execute function public.set_updated_at();

create or replace function public.audit_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_logs (user_id, action, module, record_id, old_value)
    values (auth.uid(), 'DELETE', tg_table_name, (old).id::text, to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (user_id, action, module, record_id, old_value, new_value)
    values (auth.uid(), 'UPDATE', tg_table_name, (new).id::text, to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_logs (user_id, action, module, record_id, new_value)
    values (auth.uid(), 'CREATE', tg_table_name, (new).id::text, to_jsonb(new));
    return new;
  end if;
end;
$$;

drop trigger if exists audit_policies on public.policies;
create trigger audit_policies after insert or update or delete on public.policies for each row execute function public.audit_write();

drop trigger if exists audit_clients on public.clients;
create trigger audit_clients after insert or update or delete on public.clients for each row execute function public.audit_write();

drop trigger if exists audit_insurers on public.insurers;
create trigger audit_insurers after insert or update or delete on public.insurers for each row execute function public.audit_write();

drop trigger if exists audit_staff on public.staff;
create trigger audit_staff after insert or update or delete on public.staff for each row execute function public.audit_write();

-- ============================================================
-- 0004_views.sql
-- ============================================================
create or replace view public.v_dashboard_kpis as
select
  (select count(*) from public.policies where deleted_at is null and not is_demo) as policies_count,
  (select count(*) from public.policies where deleted_at is null and not is_demo and status = 'ACTIVE') as active_policies_count,
  coalesce((select sum(gross_premium) from public.policies where deleted_at is null and not is_demo), 0) as gross_premium_total,
  coalesce((select sum(premium_collected) from public.policies where deleted_at is null and not is_demo), 0) as premium_collected_total,
  coalesce((select sum(brokerage_commission) from public.policies where deleted_at is null and not is_demo), 0) as commission_total,
  coalesce((select sum(net_premium) from public.policies where deleted_at is null and not is_demo), 0) as net_premium_total,
  (select count(*) from public.clients where deleted_at is null and not is_demo) as clients_count,
  (select count(*) from public.insurers where deleted_at is null and not is_demo) as insurers_count,
  (select count(*) from public.staff where deleted_at is null and not is_demo) as staff_count,
  (select count(*) from public.policies where deleted_at is null and not is_demo
     and date_trunc('month', transaction_date) = date_trunc('month', current_date)) as policies_this_month;

create or replace view public.v_recent_policies as
select
  p.id,
  p.policy_number,
  p.transaction_type,
  p.insured_name,
  c.client_name,
  i.insurer_name,
  p.risk_type,
  p.currency,
  p.gross_premium,
  p.premium_collected,
  p.brokerage_commission,
  p.transaction_date,
  p.created_at
from public.policies p
left join public.clients c on c.id = p.client_id
left join public.insurers i on i.id = p.insurer_id
where p.deleted_at is null and not p.is_demo
order by p.created_at desc;

-- ============================================================
-- 0005_return_tables.sql
-- ============================================================
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

alter table public.return_templates enable row level security;
create policy "return_tpls_read_auth" on public.return_templates for select to authenticated using (true);
create policy "return_tpls_write_admin" on public.return_templates for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.return_definitions enable row level security;
create policy "return_defs_read_auth" on public.return_definitions for select to authenticated using (true);
create policy "return_defs_write_admin" on public.return_definitions for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

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

-- ============================================================
-- 0006_return_views.sql
-- ============================================================
create or replace view public.v_income_production as
select
  p.id,
  p.transaction_reference,
  p.policy_number,
  p.endorsement_number,
  p.transaction_type,
  p.transaction_date,
  p.cover_from,
  p.cover_to,
  p.insured_name,
  coalesce(c.client_name, p.insured_name) as customer_name,
  p.broker_or_agent,
  p.ledger_account,
  p.sum_insured,
  p.currency,
  p.gross_premium,
  p.brokerage_commission,
  p.net_premium,
  (p.cover_to - p.cover_from) as policy_tenor_days,
  p.debit_note_number,
  p.credit_note_number,
  p.amount_received,
  p.premium_collection_date,
  p.receipt_number,
  col.bank_name,
  col.cheque_number,
  p.branch_location,
  p.remarks
from public.policies p
left join public.clients c on c.id = p.client_id
left join lateral (
  select pc.bank_name, pc.cheque_number
  from public.policy_collections pc
  where pc.policy_id = p.id
  order by pc.created_at asc
  limit 1
) col on true
where p.deleted_at is null and not p.is_demo;

create or replace view public.v_crr as
select
  p.id,
  p.transaction_date,
  p.policy_number,
  p.risk_type,
  coalesce(c.client_name, p.insured_name) as client_name,
  coalesce(i.insurer_name, '') as insurer_name,
  p.sum_insured,
  p.gross_premium,
  p.commission_rate as approved_commission_rate,
  p.tax as tax_paid,
  case when coalesce(p.gross_premium, 0) > 0
    then round(
      ((coalesce(p.brokerage_commission, 0) - coalesce(p.tax, 0) - coalesce(p.other_deductions, 0))
        / p.gross_premium) * 100, 2)
    else p.commission_rate
  end as net_commission_rate,
  p.brokerage_commission,
  p.other_deductions as other_deduction,
  (coalesce(p.gross_premium, 0) - coalesce(p.brokerage_commission, 0) - coalesce(p.other_deductions, 0)) as net_premium,
  p.amount_received,
  p.receipt_number,
  p.remarks
from public.policies p
left join public.clients c on c.id = p.client_id
left join public.insurers i on i.id = p.insurer_id
where p.deleted_at is null and not p.is_demo;

create or replace view public.v_businesses_generated as
select
  p.id,
  p.insured_name as insured,
  p.class_of_business,
  coalesce(i.insurer_name, '') as insurer_name,
  case when p.currency = 'NGN' then p.gross_premium end as gross_premium_ngn,
  case when p.currency = 'USD' then p.gross_premium end as gross_premium_usd,
  case when p.currency = 'NGN' then p.premium_collected end as premium_collected_ngn,
  case when p.currency = 'USD' then p.premium_collected end as premium_collected_usd,
  p.premium_collection_date as date_of_collection,
  case when p.currency = 'NGN' then p.premium_paid_to_insurer end as premium_paid_ngn,
  case when p.currency = 'USD' then p.premium_paid_to_insurer end as premium_paid_usd,
  p.premium_payment_date as date_of_premium_paid,
  case when p.currency = 'NGN' then p.brokerage_commission end as commission_ngn,
  case when p.currency = 'USD' then p.brokerage_commission end as commission_usd
from public.policies p
left join public.insurers i on i.id = p.insurer_id
where p.deleted_at is null and not p.is_demo;

create or replace view public.v_form_1c as
select
  coalesce(i.insurer_name, 'Unassigned') as insurer_name,
  count(*) as policy_count,
  coalesce(sum(p.gross_premium), 0) as gross_premium,
  coalesce(sum(p.premium_collected), 0) as premium_collected,
  coalesce(sum(p.premium_paid_to_insurer), 0) as premium_paid_to_insurer,
  coalesce(sum(p.brokerage_commission), 0) as brokerage_commission
from public.policies p
left join public.insurers i on i.id = p.insurer_id
where p.deleted_at is null and not p.is_demo
group by i.insurer_name;

-- ============================================================
-- 0007_compliance_tables.sql
-- ============================================================
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

create table public.regulatory_calendar (
  id                 uuid primary key default gen_random_uuid(),
  definition_id      uuid not null references public.return_definitions (id),
  return_id          uuid references public.returns (id),
  period_label       text not null,
  period_start       date not null,
  period_end         date not null,
  due_date           date,
  status             text not null default 'NOT_STARTED' check (status in ('NOT_STARTED','IN_PROGRESS','READY_FOR_REVIEW','APPROVED','SUBMITTED','OVERDUE','NOT_APPLICABLE')),
  responsible_user_id uuid references public.users (id),
  department         text,
  created_at         timestamptz not null default now(),
  unique (definition_id, period_start, period_end)
);
create index on public.regulatory_calendar (status);
create index on public.regulatory_calendar (due_date);

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

create table public.reconciliation_rules (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  source_a   jsonb not null default '{}'::jsonb,
  source_b   jsonb not null default '{}'::jsonb,
  threshold  numeric not null default 0.01,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

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

alter table public.due_date_rules enable row level security;
create policy "due_rules_read_auth" on public.due_date_rules for select to authenticated using (true);
create policy "due_rules_write_admin" on public.due_date_rules for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.regulatory_calendar enable row level security;
create policy "calendar_read_auth" on public.regulatory_calendar for select to authenticated using (true);
create policy "calendar_write_admin" on public.regulatory_calendar for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','REVIEWER'));

alter table public.reminders enable row level security;
create policy "reminders_read_auth" on public.reminders for select to authenticated using (true);
create policy "reminders_write_admin" on public.reminders for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.user_notifications enable row level security;
create policy "notifications_read_own" on public.user_notifications for select to authenticated using (auth.uid() = user_id);
create policy "notifications_write_own" on public.user_notifications for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.notification_preferences enable row level security;
create policy "notif_prefs_read_own" on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
create policy "notif_prefs_write_own" on public.notification_preferences for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.reconciliation_rules enable row level security;
create policy "recon_rules_read_auth" on public.reconciliation_rules for select to authenticated using (true);
create policy "recon_rules_write_admin" on public.reconciliation_rules for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

alter table public.reconciliation_results enable row level security;
create policy "recon_results_read_auth" on public.reconciliation_results for select to authenticated using (true);
create policy "recon_results_write_finance" on public.reconciliation_results for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','REVIEWER'));

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

-- ============================================================
-- 0013_board_meetings.sql
-- ============================================================
create table public.board_meetings (
  id               uuid primary key default gen_random_uuid(),
  meeting_number   text not null,
  meeting_type     text not null default 'SPECIAL' check (meeting_type in ('Q1','Q2','Q3','Q4','AGM','SPECIAL')),
  quarter          int check (quarter between 1 and 4),
  financial_year   int not null,
  meeting_date     date not null,
  meeting_time     text,
  venue            text,
  status           text not null default 'DRAFT' check (status in ('DRAFT','REVIEW','APPROVED','FINAL','CANCELLED')),
  chairman         text,
  secretary        text,
  agenda           jsonb not null default '[]'::jsonb,
  minutes          text not null default '',
  attendees        jsonb not null default '[]'::jsonb,
  resolutions      jsonb not null default '[]'::jsonb,
  action_points    jsonb not null default '[]'::jsonb,
  documents        jsonb not null default '[]'::jsonb,
  period_start     date,
  period_end       date,
  date_approved    timestamptz,
  approved_by      uuid references public.users (id),
  reopen_reason    text,
  created_by       uuid references public.users (id),
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index on public.board_meetings (financial_year, quarter);
create index on public.board_meetings (meeting_date);
create index on public.board_meetings (status);

alter table public.board_meetings enable row level security;
create policy "board_read_auth" on public.board_meetings for select to authenticated using (deleted_at is null);
create policy "board_write_auth" on public.board_meetings for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','REVIEWER')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','REVIEWER'));

drop trigger if exists touch_board_meetings_updated_at on public.board_meetings;
create trigger touch_board_meetings_updated_at before update on public.board_meetings for each row execute function public.set_updated_at();

-- ============================================================
-- 0014_training_records.sql
-- ============================================================
create table public.training_records (
  id                    uuid primary key default gen_random_uuid(),
  staff_name            text not null,
  position              text,
  training_title        text not null,
  training_type         text check (training_type in ('TECHNICAL','REGULATORY','COMPLIANCE','MANAGEMENT','PROFESSIONAL_DEVELOPMENT','OTHER')),
  organizer             text not null,
  training_date         date not null,
  training_end_date     date,
  duration_hours        numeric(6,1),
  training_location     text,
  what_was_learned      text,
  certificate_available boolean not null default false,
  certificate_file_name text,
  certificate_file_data text,
  training_cost         numeric(14,2),
  status                text not null default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','COMPLETED','CANCELLED')),
  remarks               text,
  is_demo               boolean not null default false,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.training_records (training_date desc);
create index on public.training_records (staff_name);
create index on public.training_records (training_type);

alter table public.training_records enable row level security;
create policy "training_read_auth" on public.training_records for select to authenticated using (deleted_at is null);
create policy "training_write_auth" on public.training_records for all to authenticated
  using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR'))
  with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR'));

create trigger touch_training_records_updated_at
  before update on public.training_records
  for each row execute function public.set_updated_at();

-- ============================================================
-- SEED DATA
-- ============================================================

-- Company profile
insert into public.company (company_name, registration_number, naicom_number, default_currency)
values ('WORLDMARK INSURANCE BROKERS LTD', null, null, 'NGN')
on conflict (id) do nothing;

-- Currencies
insert into public.currencies (code, name, symbol, decimal_places, is_base) values
  ('NGN', 'Nigerian Naira', '₦', 2, true),
  ('USD', 'US Dollar', '$', 2, false),
  ('GBP', 'British Pound', '£', 2, false),
  ('EUR', 'Euro', '€', 2, false),
  ('KES', 'Kenyan Shilling', 'KSh', 2, false),
  ('ZAR', 'South African Rand', 'R', 2, false),
  ('GHF', 'Ghanaian Cedi', 'GH₵', 2, false)
on conflict (code) do nothing;

-- Risk classes
insert into public.risk_classes (name, code) values
  ('Motor', 'MOTOR'),
  ('Group Life', 'GROUP_LIFE'),
  ('Fire', 'FIRE'),
  ('Marine', 'MARINE'),
  ('Engineering', 'ENGINEERING'),
  ('Oil and Gas', 'OIL_GAS'),
  ('Aviation', 'AVIATION'),
  ('Accident', 'ACCIDENT'),
  ('Bonds', 'BONDS'),
  ('Professional Indemnity', 'PROFESSIONAL_INDEMNITY'),
  ('Public Liability', 'PUBLIC_LIABILITY'),
  ('Employers Liability', 'EMPLOYERS_LIABILITY'),
  ('Miscellaneous', 'MISCELLANEOUS')
on conflict (name) do nothing;

-- Staff categories
insert into public.staff_categories (name) values
  ('JUNIOR STAFF'),
  ('SENIOR STAFF'),
  ('LOWER MANAGEMENT'),
  ('SENIOR MANAGEMENT')
on conflict (name) do nothing;

-- App settings
insert into public.app_settings (key, value) values
  ('default_currency', '{"code":"NGN"}'::jsonb),
  ('numbering_prefixes', '{"policy":"WMK"}'::jsonb),
  ('reminder_defaults', '{"lead_days":[30,14,7,3,1,0]}'::jsonb)
on conflict (key) do nothing;

-- Return templates
insert into public.return_templates (id, name, code, frequency, source, columns, calculations, validation_rules, export_format) values
  ('tpl-income-production', 'Income Production', 'INCOME_PRODUCTION', 'MONTHLY', 'v_income_production',
   '[{"key":"date","header":"DATE","type":"date"},{"key":"trans_ref","header":"TRANS. REF.","type":"text"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"endorsement","header":"ENDORSEMENT","type":"text"},{"key":"trans_type","header":"TRANS. TYPE","type":"text"},{"key":"cover_from","header":"PERIOD COVER FROM","type":"date"},{"key":"cover_to","header":"PERIOD COVER TO","type":"date"},{"key":"assured","header":"NAME OF ASSURED","type":"text"},{"key":"customer","header":"CUSTOMER NAME","type":"text"},{"key":"broker","header":"BROKERS/AGENT","type":"text"},{"key":"ledger_acc","header":"LEDGER ACC. NO","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"brokerage","header":"BROKERAGE","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"tenor","header":"POLICY TENOR","type":"number"},{"key":"end_date","header":"END DATE","type":"date"},{"key":"debit_note","header":"DEBIT NOTE NO","type":"text"},{"key":"credit_note","header":"CREDIT NOTE NO","type":"text"},{"key":"amount_received","header":"AMOUNT RECEIVED","type":"money"},{"key":"date_receipt","header":"DATE OF RECEIPT","type":"date"},{"key":"receipt_no","header":"RECEIPT NO.","type":"text"},{"key":"bank","header":"BANK OF LODGEMENT","type":"text"},{"key":"date_lodgement","header":"DATE OF LODGEMENT","type":"date"},{"key":"remittance","header":"REMITTANCE","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[{"output":"tenor","formula":"cover_to - cover_from (days)"}]'::jsonb,
   '[{"rule":"gross_premium >= 0"},{"rule":"brokerage_commission >= 0"}]'::jsonb,
   '{"title":"INCOME PRODUCTION","totals":["sum_insured","gross_premium","brokerage","net_premium","amount_received"],"number_format":"en-NG"}'::jsonb),
  ('tpl-pps', 'Premium Income/Production Schedule (PPS-A)', 'PPS', 'MONTHLY', 'v_income_production',
   '[{"key":"policy_no","header":"Policy No","type":"text"},{"key":"endorsement","header":"Endorsement No","type":"text"},{"key":"trans_type","header":"Transaction Type","type":"text"},{"key":"cover_from","header":"From Date","type":"date"},{"key":"cover_to","header":"To Date","type":"date"},{"key":"assured","header":"Assured","type":"text"},{"key":"customer","header":"Customer Name","type":"text"},{"key":"broker","header":"Name of Broker/Agent","type":"text"},{"key":"sum_insured","header":"Sum Insured","type":"money"},{"key":"gross_premium","header":"Premium","type":"money"},{"key":"brokerage","header":"Brokerage","type":"money"},{"key":"net_premium","header":"Net Prem","type":"money"},{"key":"tenor","header":"Policy Tenor (Days)","type":"number"},{"key":"debit_note","header":"Debit Note","type":"text"},{"key":"credit_note","header":"Credit Note No","type":"text"},{"key":"amount_received","header":"Amount Received","type":"money"},{"key":"date_receipt","header":"Date of Receipt of Premium","type":"date"},{"key":"receipt_no","header":"Receipt No","type":"text"},{"key":"bank","header":"Name of Bank of Lodgement","type":"text"},{"key":"date_lodgement","header":"Date of Lodgement","type":"date"},{"key":"insurer","header":"Name of Insurer(s)","type":"text"},{"key":"remittance","header":"Amount Remitted","type":"money"},{"key":"unremitted","header":"Amount Unremitted","type":"money"},{"key":"remittance_date","header":"Date Remitted/Transferred","type":"date"},{"key":"branch","header":"Originating Location or Branch","type":"text"},{"key":"remarks","header":"Remarks","type":"text"}]'::jsonb,
   '[{"output":"tenor","formula":"cover_to - cover_from (days)"}]'::jsonb,
   '[{"rule":"transaction_type in NEW,RNL,ADD,RTN mapped at export"}]'::jsonb,
   '{"form":"PPS-A","occurrence":"Monthly","totals":["sum_insured","gross_premium","brokerage","net_premium","amount_received"],"number_format":"en-NG"}'::jsonb),
  ('tpl-crr', 'Commission & Rebate Returns', 'CRR', 'QUARTERLY', 'v_crr',
   '[{"key":"date","header":"DATE","type":"date"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"risk_type","header":"RISK TYPE","type":"text"},{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"approved_rate","header":"APPROVED COMMISSION RATE","type":"percent"},{"key":"tax_paid","header":"TAX PAID","type":"money"},{"key":"net_rate","header":"NET COMMISSION RATE","type":"percent"},{"key":"brokerage_commission","header":"BROKERAGE COMMISSION","type":"money"},{"key":"other_deduction","header":"OTHER DEDUCTION","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"amount_received","header":"AMOUNT RECEIVED","type":"money"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[{"output":"net_rate","formula":"(brokerage_commission - tax_paid - other_deduction) / gross_premium * 100"},{"output":"net_premium","formula":"gross_premium - brokerage_commission - other_deduction"}]'::jsonb,
   '[{"rule":"commission = gross x rate verified"},{"rule":"net_premium = gross - commission - other deduction"}]'::jsonb,
   '{"title":"COMMISSION AND REBATE RETURNS (CRR)","totals":["sum_insured","gross_premium","tax_paid","brokerage_commission","other_deduction","net_premium","amount_received"],"number_format":"en-NG"}'::jsonb),
  ('tpl-businesses', 'Schedule of Businesses Generated', 'BUSINESSES_GENERATED', 'HALF_YEARLY', 'v_businesses_generated',
   '[{"key":"insured","header":"INSURED","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"insurer","header":"INSURER","type":"text"},{"key":"gp_ngn","header":"GROSS PREMIUM NAIRA","type":"money","currency":"NGN"},{"key":"gp_usd","header":"GROSS PREMIUM DOLLAR","type":"money","currency":"USD"},{"key":"pc_ngn","header":"PREMIUM COLLECTED NAIRA","type":"money","currency":"NGN"},{"key":"pc_usd","header":"PREMIUM COLLECTED DOLLAR","type":"money","currency":"USD"},{"key":"date_collection","header":"DATE OF COLLECTION","type":"date"},{"key":"pp_ngn","header":"PREMIUM PAID NAIRA","type":"money","currency":"NGN"},{"key":"pp_usd","header":"PREMIUM PAID DOLLAR","type":"money","currency":"USD"},{"key":"date_paid","header":"DATE OF PREMIUM PAID","type":"date"},{"key":"comm_ngn","header":"BROKERAGE COMMISSION NAIRA","type":"money","currency":"NGN"},{"key":"comm_usd","header":"BROKERAGE COMMISSION DOLLAR","type":"money","currency":"USD"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"gross_premium stored true (not commission)"},{"rule":"NGN/USD split by currency"}]'::jsonb,
   '{"title":"SCHEDULE OF BUSINESSES GENERATED","totals":["gp_ngn","gp_usd","pc_ngn","pc_usd","pp_ngn","pp_usd","comm_ngn","comm_usd"],"number_format":"en-NG"}'::jsonb),
  ('tpl-personnel', 'Personnel Returns', 'PERSONNEL', 'QUARTERLY', 'staff',
   '[{"key":"staff_name","header":"NAME OF STAFF","type":"text"},{"key":"staff_category","header":"STAFF CATEGORY","type":"text"},{"key":"designation","header":"DESIGNATION","type":"text"},{"key":"gender","header":"GENDER","type":"text"},{"key":"educational_qualification","header":"EDUCATIONAL QUALIFICATION","type":"text"},{"key":"professional_qualification","header":"PROFESSIONAL QUALIFICATION","type":"text"},{"key":"date_of_employment","header":"DATE OF EMPLOYMENT","type":"date"},{"key":"state_of_origin","header":"STATE OF ORIGIN","type":"text"},{"key":"location","header":"LOCATION","type":"text"},{"key":"date_of_exit","header":"DATE OF EXIT","type":"date"},{"key":"reason_for_leaving","header":"REASONS FOR LEAVING","type":"text"}]'::jsonb,
   '[{"output":"second_schedule","formula":"previous + entry - exit = current per category"}]'::jsonb,
   '[{"rule":"current = previous + entry - exit"},{"rule":"dates valid ISO"}]'::jsonb,
   '{"title":"PERSONNEL RETURNS","sheets":["FIRST SCHEDULE","SECOND SCHEDULE"],"number_format":"en-NG"}'::jsonb),
  ('tpl-form-1c', 'Form 1C', 'FORM_1C', 'AD_HOC', 'v_form_1c',
   '[{"key":"insurer","header":"INSURER","type":"text"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"collected","header":"PREMIUM COLLECTED","type":"money"},{"key":"paid","header":"PREMIUM PAID TO INSURER","type":"money"},{"key":"commission","header":"COMMISSION","type":"money"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"totals reconcile to underlying policies"}]'::jsonb,
   '{"title":"NAICOM FORM 1C","totals":["gross_premium","collected","paid","commission"],"number_format":"en-NG"}'::jsonb),
  ('tpl-brokerage-commission', 'Returns - Insurance Brokerage Commission Register', 'BROKERAGE_COMMISSION', 'ANNUAL', 'v_brokerage_commission',
   '[{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"date","header":"DATE OF POLICY","type":"date"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"commission_rate","header":"COMMISSION RATE","type":"percent"},{"key":"commission_earned","header":"COMMISSION EARNED","type":"money"},{"key":"withholding_tax","header":"WITHHOLDING TAX (WHT)","type":"money"},{"key":"net_commission","header":"NET COMMISSION RECEIVED","type":"money"},{"key":"date_received","header":"DATE COMMISSION RECEIVED","type":"date"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[{"output":"net_commission","formula":"commission_earned - withholding_tax"}]'::jsonb,
   '[{"rule":"commission = gross x rate verified"},{"rule":"net_commission = commission_earned - withholding_tax"}]'::jsonb,
   '{"title":"RETURNS - INSURANCE BROKERAGE COMMISSION REGISTER","occurrence":"Annually","totals":["sum_insured","gross_premium","commission_earned","withholding_tax","net_commission"],"number_format":"en-NG"}'::jsonb),
  ('tpl-new-policies', 'All New Policies', 'NEW_POLICIES', 'MONTHLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"trans_ref","header":"TRANS. REF.","type":"text"},{"key":"transaction_date","header":"TRANSACTION DATE","type":"date"},{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insured","header":"NAME OF INSURED","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"risk_type","header":"RISK TYPE","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"premium_collected","header":"PREMIUM COLLECTED","type":"money"},{"key":"premium_paid_to_insurer","header":"PREMIUM PAID TO INSURER","type":"money"},{"key":"brokerage_commission","header":"COMMISSION","type":"money"},{"key":"tax","header":"WITHHOLDING TAX","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"premium_due_date","header":"PREMIUM DUE DATE","type":"date"},{"key":"cover_from","header":"COVER FROM","type":"date"},{"key":"cover_to","header":"COVER TO","type":"date"},{"key":"renewal_due_date","header":"RENEWAL DUE DATE","type":"date"},{"key":"premium_collection_date","header":"PREMIUM COLLECTION DATE","type":"date"},{"key":"premium_payment_date","header":"PREMIUM PAYMENT DATE","type":"date"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"bank","header":"BANK OF LODGEMENT","type":"text"},{"key":"currency","header":"CURRENCY","type":"text"},{"key":"branch","header":"BRANCH LOCATION","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"gross_premium >= 0"},{"rule":"premium_due_date = cover_from"}]'::jsonb,
   '{"title":"ALL NEW POLICIES","occurrence":"Monthly","totals":["sum_insured","gross_premium","premium_collected","premium_paid_to_insurer","brokerage_commission","tax","net_premium"],"number_format":"en-NG"}'::jsonb),
  ('tpl-renewal-policies', 'All Renewal Policies', 'RENEWAL_POLICIES', 'MONTHLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"trans_ref","header":"TRANS. REF.","type":"text"},{"key":"transaction_date","header":"TRANSACTION DATE","type":"date"},{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insured","header":"NAME OF INSURED","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"risk_type","header":"RISK TYPE","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"premium_collected","header":"PREMIUM COLLECTED","type":"money"},{"key":"premium_paid_to_insurer","header":"PREMIUM PAID TO INSURER","type":"money"},{"key":"brokerage_commission","header":"COMMISSION","type":"money"},{"key":"tax","header":"WITHHOLDING TAX","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"premium_due_date","header":"PREMIUM DUE DATE","type":"date"},{"key":"cover_from","header":"COVER FROM","type":"date"},{"key":"cover_to","header":"COVER TO","type":"date"},{"key":"renewal_due_date","header":"RENEWAL DUE DATE","type":"date"},{"key":"premium_collection_date","header":"PREMIUM COLLECTION DATE","type":"date"},{"key":"premium_payment_date","header":"PREMIUM PAYMENT DATE","type":"date"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"bank","header":"BANK OF LODGEMENT","type":"text"},{"key":"currency","header":"CURRENCY","type":"text"},{"key":"branch","header":"BRANCH LOCATION","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"gross_premium >= 0"},{"rule":"premium_due_date = cover_from"}]'::jsonb,
   '{"title":"ALL RENEWAL POLICIES","occurrence":"Monthly","totals":["sum_insured","gross_premium","premium_collected","premium_paid_to_insurer","brokerage_commission","tax","net_premium"],"number_format":"en-NG"}'::jsonb),
  ('tpl-form-72b', 'Form 7.2B - Statement of Business Generated', 'FORM_7_2B', 'HALF_YEARLY', 'v_income_production',
   '[{"key":"month","header":"MONTH","type":"text"},{"key":"sn","header":"S/N","type":"number"},{"key":"name_of_insured","header":"NAME OF INSURED/POLICY NO.","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"sd","header":"COVER START DATE","type":"date"},{"key":"ed","header":"COVER END DATE","type":"date"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"premium_paid_directly","header":"(a) PREMIUM PAID DIRECTLY TO INSURERS","type":"money"},{"key":"premium_paid_to_brokers_local","header":"(b) PREMIUM PAID TO BROKERS (LOCAL)","type":"money"},{"key":"premium_paid_to_brokers_foreign","header":"(c) PREMIUM PAID TO BROKERS (FOREIGN)","type":"money"},{"key":"total_gross_premium","header":"(d) TOTAL GROSS PREMIUM","type":"money"},{"key":"net_premium","header":"(e) NET PREMIUM","type":"money"},{"key":"clients_bank","header":"PREMIUM IN CLIENTS BANK A/C OR CHEQUE OR CASH","type":"money"},{"key":"date_received","header":"DATE PREMIUM/CLAIMS RECEIVED","type":"date"},{"key":"premium_received_by_broker","header":"PREMIUM RECEIVED BY BROKER FROM INSURED","type":"money"},{"key":"total_commission_fee","header":"TOTAL COMMISSION FEE INCOME","type":"money"},{"key":"commission_due_to_cobrokers","header":"COMMISSION DUE TO CO-BROKERS","type":"money"},{"key":"commission_due_to_reporting","header":"COMMISSION DUE TO REPORTING BROKERS","type":"money"},{"key":"commission_income_earned","header":"COMMISSION INCOME EARNED","type":"money"},{"key":"deferred_commission","header":"DEFERRED COMMISSION INCOME","type":"money"}]'::jsonb,
   '[{"output":"net_premium","formula":"total_gross_premium - total_commission_fee"},{"output":"commission_due_to_reporting","formula":"total_commission_fee - commission_due_to_cobrokers"},{"output":"commission_income_earned","formula":"total_commission_fee * premium_collected / gross_premium"},{"output":"deferred_commission","formula":"total_commission_fee - commission_income_earned"}]'::jsonb,
   '[{"rule":"total_gross_premium = (a) + (b) + (c)"},{"rule":"commission_income_earned + deferred_commission = total_commission_fee"}]'::jsonb,
   '{"title":"FORM 7.2B - STATEMENT OF BUSINESS GENERATED IN THE HALF YEAR","form":"FORM 7.2B","occurrence":"Half-Yearly","totals":["sum_insured","total_gross_premium","net_premium","premium_received_by_broker","total_commission_fee","commission_due_to_cobrokers","commission_due_to_reporting","commission_income_earned","deferred_commission"],"number_format":"en-NG"}'::jsonb),
  ('tpl-form-72c', 'Form 7.2C - Schedule of Remittances', 'FORM_7_2C', 'HALF_YEARLY', 'v_income_production',
   '[{"key":"month","header":"MONTH","type":"text"},{"key":"sn","header":"S/N","type":"number"},{"key":"name_of_insured","header":"NAME OF INSURED/POLICY NO.","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"sd","header":"COVER START DATE","type":"date"},{"key":"ed","header":"COVER END DATE","type":"date"},{"key":"total_received","header":"(a) TOTAL PREMIUM/CLAIMS RECEIVED BY THE BROKERS","type":"money"},{"key":"premium_due_to_insurers","header":"(b) PREMIUM DUE TO INSURERS (NET OF VAT)","type":"money"},{"key":"deposit_by_insured","header":"(c) DEPOSIT MADE INTO CLIENTS ACCOUNT BY INSURED","type":"money"},{"key":"returned_premium_due","header":"(d) RETURNED PREMIUM DUE TO INSURED","type":"money"},{"key":"claims_due","header":"(e) CLAIMS DUE TO INSURED","type":"money"},{"key":"vat_due","header":"(f) VAT DUE TO FIRS/SIRS","type":"money"},{"key":"commission_due_cobrokers","header":"(g) COMMISSION DUE TO CO-BROKER(S)","type":"money"},{"key":"commission_due_reporting","header":"(h) COMMISSION DUE TO REPORTING BROKER","type":"money"},{"key":"date_remitted","header":"DATE PREMIUM/CLAIMS/VAT/COMMISSION REMITTED","type":"date"},{"key":"paying_bank","header":"CLIENTS ACCOUNT PAYING BANK","type":"text"},{"key":"premium_remitted","header":"(i) PREMIUM REMITTED TO INSURERS","type":"money"},{"key":"claims_remitted","header":"(j) CLAIMS/RETURNED PREMIUM/DEPOSIT REMITTED TO INSURED","type":"money"},{"key":"vat_remitted","header":"(k) VAT REMITTED TO FIRS/SIRS","type":"money"},{"key":"commission_remitted","header":"(L) COMMISSION REMITTED TO CO-BROKERS AND REPORTING BROKER","type":"money"},{"key":"outstanding_premium","header":"(m) OUTSTANDING PREMIUM DUE TO INSURERS","type":"money"},{"key":"outstanding_claims","header":"(n) OUTSTANDING CLAIMS/RETURNED PREMIUM/DEPOSIT DUE TO INSURED","type":"money"},{"key":"outstanding_vat","header":"(o) OUTSTANDING VAT DUE TO FIRS/SIRS","type":"money"},{"key":"outstanding_commission","header":"(p) OUTSTANDING COMMISSION DUE TO CO-BROKERS AND REPORTING BROKER","type":"money"}]'::jsonb,
   '[{"output":"outstanding_premium","formula":"premium_due_to_insurers - premium_remitted"},{"output":"outstanding_claims","formula":"deposit_by_insured + returned_premium_due + claims_due - claims_remitted"},{"output":"outstanding_vat","formula":"vat_due - vat_remitted"},{"output":"outstanding_commission","formula":"commission_due_cobrokers + commission_due_reporting - commission_remitted"}]'::jsonb,
   '[{"rule":"outstanding_premium = (b) - (i)"},{"rule":"outstanding_commission = (g) + (h) - (L)"}]'::jsonb,
   '{"title":"FORM 7.2C - SCHEDULE OF REMITTANCES IN RESPECT OF BUSINESS GENERATED IN THE HALF YEAR","form":"FORM 7.2C","occurrence":"Half-Yearly","totals":["total_received","premium_due_to_insurers","commission_due_reporting","premium_remitted","commission_remitted","outstanding_premium","outstanding_commission"],"number_format":"en-NG"}'::jsonb),
  ('tpl-claims-awaiting', 'Schedule of Claims Awaiting Payment', 'CLAIMS_AWAITING', 'QUARTERLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"date_notified_by_insured","header":"DATE OF CLAIM NOTIFICATION BY INSURED","type":"date"},{"key":"date_notified_to_insurer","header":"DATE OF CLAIM NOTIFICATION TO INSURER","type":"date"},{"key":"insurer_name","header":"NAME OF INSURER","type":"text"},{"key":"claim_no","header":"CLAIM NO.","type":"text"},{"key":"claim_amount","header":"CLAIM AMOUNT","type":"money"},{"key":"date_discharge_voucher","header":"DATE OF RECEIPT OF DISCHARGE VOUCHER","type":"date"},{"key":"insured_beneficiary","header":"NAME OF INSURED/BENEFICIARY","type":"text"},{"key":"date_payment","header":"DATE OF PAYMENT BY INSURER","type":"text"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"claim_amount >= 0"}]'::jsonb,
   '{"title":"SCHEDULE OF CLAIMS AWAITING PAYMENT","occurrence":"Quarterly","totals":["claim_amount"],"number_format":"en-NG"}'::jsonb),
  ('tpl-biz-schedule', 'Business Schedule and Premium Transmission', 'BIZ_SCHEDULE', 'QUARTERLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"insured_name","header":"NAME OF INSURED","type":"text"},{"key":"insurer_name","header":"NAME OF INSURER","type":"text"},{"key":"policy_no","header":"POLICY NO.","type":"text"},{"key":"policy_detail","header":"POLICY DETAIL","type":"text"},{"key":"commencement_of_risk","header":"COMMENCEMENT OF RISK","type":"date"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"premium_local","header":"PREMIUM (LOCAL)","type":"money","currency":"NGN"},{"key":"premium_foreign","header":"PREMIUM (FOREIGN)","type":"money","currency":"USD"},{"key":"date_received","header":"DATE OF RECEIPT OF PREMIUM","type":"date"},{"key":"date_transmitted","header":"DATE OF TRANSMISSION OF PREMIUM","type":"date"},{"key":"commission_local","header":"COMMISSION (LOCAL)","type":"money","currency":"NGN"},{"key":"commission_foreign","header":"COMMISSION (FOREIGN)","type":"money","currency":"USD"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"premium_local >= 0"},{"rule":"premium_foreign >= 0"}]'::jsonb,
   '{"title":"BUSINESS SCHEDULE AND PREMIUM TRANSMISSION","occurrence":"Quarterly","totals":["sum_insured","premium_local","premium_foreign","commission_local","commission_foreign"],"number_format":"en-NG"}'::jsonb)
on conflict (code) do nothing;

-- Return definitions
insert into public.return_definitions (id, name, code, form_number, frequency, responsible_department, data_source, template_id, active, requires_confirmation) values
  ('rd-income-production','Income Production','INCOME_PRODUCTION',null,'MONTHLY','Operations/Finance','v_income_production','tpl-income-production',true,false),
  ('rd-pps','Premium Income/Production Schedule (PPS-A)','PPS','PPS-A','MONTHLY','Finance','v_income_production','tpl-pps',true,false),
  ('rd-crr','Commission & Rebate Returns','CRR',null,'QUARTERLY','Finance','v_crr','tpl-crr',true,false),
  ('rd-businesses','Schedule of Businesses Generated','BUSINESSES_GENERATED',null,'HALF_YEARLY','Operations','v_businesses_generated','tpl-businesses',true,false),
  ('rd-personnel','Personnel Returns','PERSONNEL',null,'QUARTERLY','HR','staff','tpl-personnel',true,false),
  ('rd-form-1c','Form 1C','FORM_1C','NAICOM Form 1C','AD_HOC','Finance','v_form_1c','tpl-form-1c',true,false),
  ('rd-brokerage-commission','Returns - Insurance Brokerage Commission Register','BROKERAGE_COMMISSION',null,'ANNUAL','Finance','v_brokerage_commission','tpl-brokerage-commission',true,false),
  ('rd-new-policies','All New Policies','NEW_POLICIES',null,'MONTHLY','Operations','policies','tpl-new-policies',true,false),
  ('rd-renewal-policies','All Renewal Policies','RENEWAL_POLICIES',null,'MONTHLY','Operations','policies','tpl-renewal-policies',true,false),
  ('rd-form-72b','Form 7.2B - Statement of Business Generated','FORM_7_2B','FORM 7.2B','HALF_YEARLY','Operations/Finance','v_income_production','tpl-form-72b',true,false),
  ('rd-form-72c','Form 7.2C - Schedule of Remittances','FORM_7_2C','FORM 7.2C','HALF_YEARLY','Finance','v_income_production','tpl-form-72c',true,false),
  ('rd-claims-awaiting','Schedule of Claims Awaiting Payment','CLAIMS_AWAITING',null,'QUARTERLY','Operations','policies','tpl-claims-awaiting',true,false),
  ('rd-biz-schedule','Business Schedule and Premium Transmission','BIZ_SCHEDULE',null,'QUARTERLY','Operations/Finance','policies','tpl-biz-schedule',true,false)
on conflict (code) do nothing;

-- Due-date rules
insert into public.due_date_rules (id, definition_id, rule, effective_from, confirmed, source) values
  ('ddr-ip','rd-income-production','{"frequency":"MONTHLY","day_of_month":15}'::jsonb,'2026-01-01',true,'NAICOM monthly returns guideline'),
  ('ddr-pps','rd-pps','{"frequency":"MONTHLY","day_of_month":15}'::jsonb,'2026-01-01',true,'NAICOM monthly returns guideline'),
  ('ddr-crr','rd-crr','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM quarterly returns directive'),
  ('ddr-biz','rd-businesses','{"frequency":"HALF_YEARLY","days_after_period_end":30}'::jsonb,'2026-01-01',true,'NAICOM half-yearly returns directive'),
  ('ddr-per','rd-personnel','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM personnel returns directive'),
  ('ddr-f1c','rd-form-1c','{"frequency":"AD_HOC","fixed_date":"2026-03-31"}'::jsonb,'2026-01-01',false,'NAICOM circular'),
  ('ddr-bcr','rd-brokerage-commission','{"frequency":"ANNUAL","due_month":1,"due_day":31}'::jsonb,'2026-01-01',true,'NAICOM annual returns'),
  ('ddr-72b','rd-form-72b','{"frequency":"HALF_YEARLY","days_after_period_end":30}'::jsonb,'2026-01-01',true,'NAICOM half-yearly returns directive'),
  ('ddr-72c','rd-form-72c','{"frequency":"HALF_YEARLY","days_after_period_end":30}'::jsonb,'2026-01-01',true,'NAICOM half-yearly returns directive'),
  ('ddr-claims','rd-claims-awaiting','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM quarterly claims returns directive'),
  ('ddr-bizsch','rd-biz-schedule','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM quarterly business schedule directive')
on conflict (id) do nothing;

-- Link templates to their due-date rules
update public.return_templates t
set due_rule_id = d.id
from public.due_date_rules d
join public.return_definitions rd on rd.id = d.definition_id
where rd.template_id = t.id;

-- Reconciliation rules
insert into public.reconciliation_rules (id, name, source_a, source_b, threshold, active) values
  ('rc-comm','Commission consistency — CRR vs Income Production','{"definition_code":"CRR","column":"brokerage_commission"}'::jsonb,'{"definition_code":"INCOME_PRODUCTION","column":"brokerage"}'::jsonb,0.01,true),
  ('rc-premium','Premium consistency — Businesses Generated vs Income Production','{"definition_code":"BUSINESSES_GENERATED","column":"gp_ngn"}'::jsonb,'{"definition_code":"INCOME_PRODUCTION","column":"gross_premium"}'::jsonb,0.01,true),
  ('rc-form1c','Form 1C integrity — totals vs underlying policies','{"definition_code":"FORM_1C","column":"gross_premium"}'::jsonb,'{"source":"policies","column":"gross_premium"}'::jsonb,0.01,true),
  ('rc-collection','Collection sanity — policy collections vs policies','{"source":"policy_collections","column":"amount"}'::jsonb,'{"source":"policies","column":"premium_collected"}'::jsonb,0.01,true),
  ('rc-remittance','Remittance sanity — policy remittances vs policies','{"source":"policy_remittances","column":"amount"}'::jsonb,'{"source":"policies","column":"premium_paid_to_insurer"}'::jsonb,0.01,true),
  ('rc-register','Commission register — Brokerage Commission Register vs CRR','{"definition_code":"BROKERAGE_COMMISSION","column":"commission_earned"}'::jsonb,'{"definition_code":"CRR","column":"brokerage_commission"}'::jsonb,0.01,true),
  ('rc-rate','Commission vs rate — policies vs commission rate × gross','{"source":"policies","column":"brokerage_commission"}'::jsonb,'{"source":"policies","column":"commission_rate * gross_premium"}'::jsonb,1,true)
on conflict (id) do nothing;
