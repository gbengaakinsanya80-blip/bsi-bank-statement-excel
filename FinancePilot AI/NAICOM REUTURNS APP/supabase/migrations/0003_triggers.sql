-- ============================================================
-- 0003_triggers.sql — updated_at touch + audit trail
-- ============================================================

-- Touch updated_at on any change.
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

-- ------------------------------------------------------------
-- Audit trail: INSERT/UPDATE/DELETE on core tables -> audit_logs
-- (security definer so inserts bypass RLS on audit_logs).
-- ------------------------------------------------------------
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
