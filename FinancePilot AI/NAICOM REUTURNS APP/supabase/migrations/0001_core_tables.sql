-- ============================================================
-- 0001_core_tables.sql
-- WORLDMARK NAICOM RETURNS MANAGEMENT SYSTEM — Phase 1
-- Base tables (schema doc 03: tables 1–12, 24, 26–28, 32),
-- auth-user bootstrap, and helper functions.
-- Conventions: lowercase snake_case text + CHECK constraints,
-- uuid PKs via gen_random_uuid(), money numeric, soft delete
-- via deleted_at on business-critical tables.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. company — single-row profile (default WORLDMARK)
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 2. users — maps 1:1 to auth.users
-- ------------------------------------------------------------
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

-- Auto-provision public.users on new auth signup.
-- The very first user becomes SUPER_ADMIN (bootstrap).
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

-- ------------------------------------------------------------
-- 3. audit_logs
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 4. clients
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 5. insurers
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 6. risk_classes — configurable risk categories
-- ------------------------------------------------------------
create table public.risk_classes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  code       text,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. staff_categories
-- ------------------------------------------------------------
create table public.staff_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. staff — permanent Staff Master
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 9. currencies
-- ------------------------------------------------------------
create table public.currencies (
  code           char(3) primary key,
  name           text,
  symbol         text,
  decimal_places smallint not null default 2,
  is_base        boolean not null default false
);

-- ------------------------------------------------------------
-- 10. policies — MASTER BUSINESS/POLICY DATABASE (fact table)
-- ------------------------------------------------------------
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

-- Duplicate-detection guard (soft-deleted excluded).
create unique index policies_duplicate_guard
  on public.policies (policy_number, coalesce(endorsement_number, ''), client_id, insurer_id, transaction_date, gross_premium)
  where deleted_at is null and policy_number is not null;

-- ------------------------------------------------------------
-- 11. policy_collections — premium receipts per policy
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 12. policy_remittances — premium paid to insurer per policy
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 24. attachments — Supabase Storage-backed
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 26. regulatory_references — Regulatory Source Register
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 27. import_jobs
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 28. import_mappings — reusable column-mapping templates
-- ------------------------------------------------------------
create table public.import_mappings (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  target_table text not null check (target_table in ('policies','clients','insurers','staff')),
  mapping      jsonb not null default '{}'::jsonb,
  created_by   uuid references public.users (id),
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 32. app_settings — key/value settings module
-- ------------------------------------------------------------
create table public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.users (id),
  updated_at timestamptz not null default now()
);
