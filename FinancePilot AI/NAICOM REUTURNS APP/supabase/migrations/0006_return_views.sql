-- ============================================================
-- 0006_return_views.sql — Phase 2 reporting views
-- One row per policy for Income Production / CRR /
-- Businesses Generated; insurer-grouped for Form 1C.
-- Demo data (is_demo = true) is excluded.
-- These mirror the TS builders in src/lib/returns/builders.ts
-- (single source of truth for row construction is the app code;
-- views support SQL-level reporting/export).
-- ============================================================

-- Income Production / PPS source rows (one per policy).
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

-- CRR source rows with derived net commission rate / net premium.
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

-- Businesses Generated source rows with Naira/Dollar splits.
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

-- Form 1C source rows (grouped by insurer).
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
