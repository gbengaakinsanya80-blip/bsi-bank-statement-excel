-- ============================================================
-- seed.sql — WORLDMARK masters + demo data (is_demo = true)
-- Idempotent: safe to run more than once.
-- ============================================================

-- Company profile -------------------------------------------------
insert into public.company (company_name, registration_number, naicom_number, default_currency)
values ('WORLDMARK INSURANCE BROKERS LTD', null, null, 'NGN')
on conflict (id) do nothing;

-- Currencies ------------------------------------------------------
insert into public.currencies (code, name, symbol, decimal_places, is_base) values
  ('NGN', 'Nigerian Naira',    '₦', 2, true),
  ('USD', 'US Dollar',         '$', 2, false),
  ('GBP', 'British Pound',     '£', 2, false),
  ('EUR', 'Euro',              '€', 2, false),
  ('KES', 'Kenyan Shilling',   'KSh', 2, false),
  ('ZAR', 'South African Rand','R', 2, false),
  ('GHF', 'Ghanaian Cedi',     'GH₵', 2, false)
on conflict (code) do nothing;

-- Risk classes ----------------------------------------------------
insert into public.risk_classes (name, code) values
  ('Motor',                'MOTOR'),
  ('Group Life',           'GROUP_LIFE'),
  ('Fire',                 'FIRE'),
  ('Marine',               'MARINE'),
  ('Engineering',          'ENGINEERING'),
  ('Oil and Gas',          'OIL_GAS'),
  ('Aviation',             'AVIATION'),
  ('Accident',             'ACCIDENT'),
  ('Bonds',                'BONDS'),
  ('Professional Indemnity', 'PROFESSIONAL_INDEMNITY'),
  ('Public Liability',     'PUBLIC_LIABILITY'),
  ('Employers Liability',  'EMPLOYERS_LIABILITY'),
  ('Miscellaneous',        'MISCELLANEOUS')
on conflict (name) do nothing;

-- Staff categories (standard set used by the Personnel return) -----
insert into public.staff_categories (name) values
  ('JUNIOR STAFF'),
  ('SENIOR STAFF'),
  ('LOWER MANAGEMENT'),
  ('SENIOR MANAGEMENT')
on conflict (name) do nothing;

-- Sample insurers (demo) ------------------------------------------
insert into public.insurers (insurer_name, naicom_code, active, is_demo) values
  ('AXA Mansard Insurance Plc',   null, true, true),
  ('Leadway Assurance Company Ltd', null, true, true),
  ('AIICO Insurance Plc',          null, true, true),
  ('Cornerstone Insurance Plc',    null, true, true)
on conflict do nothing;

-- Sample clients (demo) -------------------------------------------
insert into public.clients (client_name, industry, status, is_demo) values
  ('Zenith Bank Plc',          'Banking',    'ACTIVE', true),
  ('Dangote Cement Plc',       'Manufacturing', 'ACTIVE', true),
  ('Lagos State Government',   'Government', 'ACTIVE', true),
  ('MTN Nigeria Communications Plc', 'Telecom', 'ACTIVE', true)
on conflict do nothing;

-- Sample staff (demo) ---------------------------------------------
insert into public.staff (staff_name, staff_category_id, designation, gender, date_of_employment, is_demo)
select 'Adaeze Okafor', id, 'Managing Director', 'FEMALE', '2010-01-04', true from public.staff_categories where name = 'SENIOR MANAGEMENT'
union all
select 'Emeka Obi', id, 'Operations Manager', 'MALE', '2013-06-17', true from public.staff_categories where name = 'LOWER MANAGEMENT'
union all
select 'Funke Adeyemi', id, 'Finance Officer', 'FEMALE', '2018-03-12', true from public.staff_categories where name = 'SENIOR STAFF'
on conflict do nothing;

-- App settings ----------------------------------------------------
insert into public.app_settings (key, value) values
  ('default_currency', '{"code":"NGN"}'::jsonb),
  ('numbering_prefixes', '{"policy":"WMK"}'::jsonb),
  ('reminder_defaults', '{"lead_days":[30,14,7,3,1,0]}'::jsonb)
on conflict (key) do nothing;

-- Return templates (data-driven engine) ---------------------------
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
   '{"title":"RETURNS - INSURANCE BROKERAGE COMMISSION REGISTER","occurrence":"Annually","totals":["sum_insured","gross_premium","commission_earned","withholding_tax","net_commission"],"number_format":"en-NG"}'::jsonb)
on conflict (code) do nothing;

-- Return definitions (catalogue) -----------------------------------
insert into public.return_definitions (id, name, code, form_number, frequency, responsible_department, data_source, template_id, active, requires_confirmation) values
  ('rd-income-production','Income Production','INCOME_PRODUCTION',null,'MONTHLY','Operations/Finance','v_income_production','tpl-income-production',true,false),
  ('rd-pps','Premium Income/Production Schedule (PPS-A)','PPS','PPS-A','MONTHLY','Finance','v_income_production','tpl-pps',true,false),
  ('rd-crr','Commission & Rebate Returns','CRR',null,'QUARTERLY','Finance','v_crr','tpl-crr',true,false),
  ('rd-businesses','Schedule of Businesses Generated','BUSINESSES_GENERATED',null,'HALF_YEARLY','Operations','v_businesses_generated','tpl-businesses',true,false),
  ('rd-personnel','Personnel Returns','PERSONNEL',null,'QUARTERLY','HR','staff','tpl-personnel',true,false),
  ('rd-form-1c','Form 1C','FORM_1C','NAICOM Form 1C','AD_HOC','Finance','v_form_1c','tpl-form-1c',true,false),
  ('rd-brokerage-commission','Returns - Insurance Brokerage Commission Register','BROKERAGE_COMMISSION',null,'ANNUAL','Finance','v_brokerage_commission','tpl-brokerage-commission',true,false)
on conflict (code) do nothing;

-- Due-date rules (configurable NAICOM deadlines, PRD §42) ---------
insert into public.due_date_rules (id, definition_id, rule, effective_from, confirmed, source) values
  ('ddr-ip','rd-income-production','{"frequency":"MONTHLY","day_of_month":15}'::jsonb,'2026-01-01',true,'NAICOM monthly returns guideline'),
  ('ddr-pps','rd-pps','{"frequency":"MONTHLY","day_of_month":15}'::jsonb,'2026-01-01',true,'NAICOM monthly returns guideline'),
  ('ddr-crr','rd-crr','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM quarterly returns directive'),
  ('ddr-biz','rd-businesses','{"frequency":"HALF_YEARLY","days_after_period_end":30}'::jsonb,'2026-01-01',true,'NAICOM half-yearly returns directive'),
  ('ddr-per','rd-personnel','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM personnel returns directive'),
  ('ddr-f1c','rd-form-1c','{"frequency":"AD_HOC","fixed_date":"2026-03-31"}'::jsonb,'2026-01-01',false,'NAICOM circular — deadline to be confirmed'),
  ('ddr-bcr','rd-brokerage-commission','{"frequency":"ANNUAL","due_month":1,"due_day":31}'::jsonb,'2026-01-01',true,'NAICOM annual returns — due 31 January of the following year')
on conflict (id) do nothing;

-- Link templates to their due-date rules --------------------------
update public.return_templates t
set due_rule_id = d.id
from public.due_date_rules d
join public.return_definitions rd on rd.id = d.definition_id
where rd.template_id = t.id;

-- Reconciliation rules (pre-configured cross-return checks) -------
insert into public.reconciliation_rules (id, name, source_a, source_b, threshold, active) values
  ('rc-comm','Commission consistency — CRR vs Income Production','{"definition_code":"CRR","column":"brokerage_commission"}'::jsonb,'{"definition_code":"INCOME_PRODUCTION","column":"brokerage"}'::jsonb,0.01,true),
  ('rc-premium','Premium consistency — Businesses Generated vs Income Production','{"definition_code":"BUSINESSES_GENERATED","column":"gp_ngn"}'::jsonb,'{"definition_code":"INCOME_PRODUCTION","column":"gross_premium"}'::jsonb,0.01,true),
  ('rc-form1c','Form 1C integrity — totals vs underlying policies','{"definition_code":"FORM_1C","column":"gross_premium"}'::jsonb,'{"source":"policies","column":"gross_premium"}'::jsonb,0.01,true),
  ('rc-collection','Collection sanity — policy collections vs policies','{"source":"policy_collections","column":"amount"}'::jsonb,'{"source":"policies","column":"premium_collected"}'::jsonb,0.01,true),
  ('rc-remittance','Remittance sanity — policy remittances vs policies','{"source":"policy_remittances","column":"amount"}'::jsonb,'{"source":"policies","column":"premium_paid_to_insurer"}'::jsonb,0.01,true),
  ('rc-register','Commission register — Brokerage Commission Register vs CRR','{"definition_code":"BROKERAGE_COMMISSION","column":"commission_earned"}'::jsonb,'{"definition_code":"CRR","column":"brokerage_commission"}'::jsonb,0.01,true),
  ('rc-rate','Commission vs rate — policies vs commission rate × gross','{"source":"policies","column":"brokerage_commission"}'::jsonb,'{"source":"policies","column":"commission_rate * gross_premium"}'::jsonb,1,true)
on conflict (id) do nothing;
