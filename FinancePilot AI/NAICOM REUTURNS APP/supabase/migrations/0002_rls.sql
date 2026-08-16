-- ============================================================
-- 0002_rls.sql — Row Level Security policies
-- Roles: SUPER_ADMIN, ADMIN, FINANCE, OPERATIONS, HR,
--        REVIEWER, VIEWER (public.users.role)
-- ============================================================

-- Role lookup helper used inside policies (security definer
-- to avoid recursion and bypass RLS on public.users).
create or replace function public.app_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where id = auth.uid();
$$;

-- ------------------------------------------------------------
-- company
-- ------------------------------------------------------------
alter table public.company enable row level security;
create policy "company_read_auth" on public.company for select to authenticated using (true);
create policy "company_write_admin" on public.company for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
alter table public.users enable row level security;
create policy "users_read_own_or_admin" on public.users for select to authenticated using (id = auth.uid() or public.app_user_role() in ('SUPER_ADMIN','ADMIN'));
create policy "users_write_admin" on public.users for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

-- ------------------------------------------------------------
-- audit_logs — insert-only (via security-definer triggers);
-- read restricted to admins.
-- ------------------------------------------------------------
alter table public.audit_logs enable row level security;
create policy "audit_read_admin" on public.audit_logs for select to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

-- ------------------------------------------------------------
-- clients / insurers / risk_classes / staff_categories / staff
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- policies / policy_collections / policy_remittances
-- ------------------------------------------------------------
alter table public.policies enable row level security;
create policy "policies_read_auth" on public.policies for select to authenticated using (true);
create policy "policies_write_finance" on public.policies for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.policy_collections enable row level security;
create policy "collections_read_auth" on public.policy_collections for select to authenticated using (true);
create policy "collections_write_finance" on public.policy_collections for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.policy_remittances enable row level security;
create policy "remittances_read_auth" on public.policy_remittances for select to authenticated using (true);
create policy "remittances_write_finance" on public.policy_remittances for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

-- ------------------------------------------------------------
-- currencies
-- ------------------------------------------------------------
alter table public.currencies enable row level security;
create policy "currencies_read_auth" on public.currencies for select to authenticated using (true);
create policy "currencies_write_admin" on public.currencies for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

-- ------------------------------------------------------------
-- attachments
-- ------------------------------------------------------------
alter table public.attachments enable row level security;
create policy "attachments_read_auth" on public.attachments for select to authenticated using (true);
create policy "attachments_write_finance" on public.attachments for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','HR')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS','HR'));

-- ------------------------------------------------------------
-- regulatory_references
-- ------------------------------------------------------------
alter table public.regulatory_references enable row level security;
create policy "reg_refs_read_auth" on public.regulatory_references for select to authenticated using (true);
create policy "reg_refs_write_admin" on public.regulatory_references for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));

-- ------------------------------------------------------------
-- import_jobs / import_mappings
-- ------------------------------------------------------------
alter table public.import_jobs enable row level security;
create policy "import_jobs_read_auth" on public.import_jobs for select to authenticated using (true);
create policy "import_jobs_write_ops" on public.import_jobs for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

alter table public.import_mappings enable row level security;
create policy "import_mappings_read_auth" on public.import_mappings for select to authenticated using (true);
create policy "import_mappings_write_ops" on public.import_mappings for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN','FINANCE','OPERATIONS'));

-- ------------------------------------------------------------
-- app_settings
-- ------------------------------------------------------------
alter table public.app_settings enable row level security;
create policy "app_settings_read_admin" on public.app_settings for select to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));
create policy "app_settings_write_admin" on public.app_settings for all to authenticated using (public.app_user_role() in ('SUPER_ADMIN','ADMIN')) with check (public.app_user_role() in ('SUPER_ADMIN','ADMIN'));
