-- ============================================================
-- 0004_views.sql — Phase 1 reporting views
-- Demo data (is_demo = true) is excluded from all KPI views.
-- ============================================================

-- Dashboard KPI cards + business statistics.
create or replace view public.v_dashboard_kpis as
select
  (select count(*) from public.policies where deleted_at is null and not is_demo)                                as policies_count,
  (select count(*) from public.policies where deleted_at is null and not is_demo and status = 'ACTIVE')          as active_policies_count,
  coalesce((select sum(gross_premium)    from public.policies where deleted_at is null and not is_demo), 0)      as gross_premium_total,
  coalesce((select sum(premium_collected) from public.policies where deleted_at is null and not is_demo), 0)     as premium_collected_total,
  coalesce((select sum(brokerage_commission) from public.policies where deleted_at is null and not is_demo), 0)  as commission_total,
  coalesce((select sum(net_premium)      from public.policies where deleted_at is null and not is_demo), 0)      as net_premium_total,
  (select count(*) from public.clients where deleted_at is null and not is_demo)                                as clients_count,
  (select count(*) from public.insurers where deleted_at is null and not is_demo)                               as insurers_count,
  (select count(*) from public.staff    where deleted_at is null and not is_demo)                               as staff_count,
  (select count(*) from public.policies where deleted_at is null and not is_demo
     and date_trunc('month', transaction_date) = date_trunc('month', current_date))                             as policies_this_month;

-- Recent policies for the dashboard activity feed.
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
left join public.clients  c on c.id = p.client_id
left join public.insurers i on i.id = p.insurer_id
where p.deleted_at is null and not p.is_demo
order by p.created_at desc;
