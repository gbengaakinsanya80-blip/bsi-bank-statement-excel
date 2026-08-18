-- ============================================================
-- 0014_training_records.sql — Staff Training & Development
-- ============================================================

create table public.training_records (
  id                    uuid primary key default gen_random_uuid(),
  staff_name            text not null,
  position              text,
  training_title        text not null,
  training_type         text check (training_type in (
                          'TECHNICAL','REGULATORY','COMPLIANCE',
                          'MANAGEMENT','PROFESSIONAL_DEVELOPMENT','OTHER'
                        )),
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
  status                text not null default 'PLANNED' check (status in (
                          'PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'
                        )),
  remarks               text,
  is_demo               boolean not null default false,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index on public.training_records (training_date desc);
create index on public.training_records (staff_name);
create index on public.training_records (training_type);

-- RLS -----------------------------------------------------------
alter table public.training_records enable row level security;
create policy "training_read_auth"  on public.training_records for select to authenticated using (deleted_at is null);
create policy "training_write_auth" on public.training_records for all to authenticated
  using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR'))
  with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','HR'));

-- Triggers ------------------------------------------------------
create trigger touch_training_records_updated_at
  before update on public.training_records
  for each row execute function public.set_updated_at();
