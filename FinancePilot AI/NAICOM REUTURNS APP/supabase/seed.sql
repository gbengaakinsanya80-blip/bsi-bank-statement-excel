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
insert into public.return_templates (name, code, frequency, source, columns, calculations, validation_rules, export_format) values
  ('Income Production', 'INCOME_PRODUCTION', 'MONTHLY', 'v_income_production',
   '[{"key":"date","header":"DATE","type":"date"},{"key":"trans_ref","header":"TRANS. REF.","type":"text"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"endorsement","header":"ENDORSEMENT","type":"text"},{"key":"trans_type","header":"TRANS. TYPE","type":"text"},{"key":"cover_from","header":"PERIOD COVER FROM","type":"date"},{"key":"cover_to","header":"PERIOD COVER TO","type":"date"},{"key":"assured","header":"NAME OF ASSURED","type":"text"},{"key":"customer","header":"CUSTOMER NAME","type":"text"},{"key":"broker","header":"BROKERS/AGENT","type":"text"},{"key":"ledger_acc","header":"LEDGER ACC. NO","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"brokerage","header":"BROKERAGE","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"tenor","header":"POLICY TENOR","type":"number"},{"key":"end_date","header":"END DATE","type":"date"},{"key":"debit_note","header":"DEBIT NOTE NO","type":"text"},{"key":"credit_note","header":"CREDIT NOTE NO","type":"text"},{"key":"amount_received","header":"AMOUNT RECEIVED","type":"money"},{"key":"date_receipt","header":"DATE OF RECEIPT","type":"date"},{"key":"receipt_no","header":"RECEIPT NO.","type":"text"},{"key":"bank","header":"BANK OF LODGEMENT","type":"text"},{"key":"date_lodgement","header":"DATE OF LODGEMENT","type":"date"},{"key":"remittance","header":"REMITTANCE","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[{"output":"tenor","formula":"cover_to - cover_from (days)"}]'::jsonb,
   '[{"rule":"gross_premium >= 0"},{"rule":"brokerage_commission >= 0"}]'::jsonb,
   '{"title":"INCOME PRODUCTION","totals":["sum_insured","gross_premium","brokerage","net_premium","amount_received"],"number_format":"en-NG"}'::jsonb),
  ('Premium Income/Production Schedule (PPS-A)', 'PPS', 'MONTHLY', 'v_income_production',
   '[{"key":"policy_no","header":"Policy No","type":"text"},{"key":"endorsement","header":"Endorsement No","type":"text"},{"key":"trans_type","header":"Transaction Type","type":"text"},{"key":"cover_from","header":"From Date","type":"date"},{"key":"cover_to","header":"To Date","type":"date"},{"key":"assured","header":"Assured","type":"text"},{"key":"customer","header":"Customer Name","type":"text"},{"key":"broker","header":"Name of Broker/Agent","type":"text"},{"key":"sum_insured","header":"Sum Insured","type":"money"},{"key":"gross_premium","header":"Premium","type":"money"},{"key":"brokerage","header":"Brokerage","type":"money"},{"key":"net_premium","header":"Net Prem","type":"money"},{"key":"tenor","header":"Policy Tenor (Days)","type":"number"},{"key":"debit_note","header":"Debit Note","type":"text"},{"key":"credit_note","header":"Credit Note No","type":"text"},{"key":"amount_received","header":"Amount Received","type":"money"},{"key":"date_receipt","header":"Date of Receipt of Premium","type":"date"},{"key":"receipt_no","header":"Receipt No","type":"text"},{"key":"bank","header":"Name of Bank of Lodgement","type":"text"},{"key":"date_lodgement","header":"Date of Lodgement","type":"date"},{"key":"insurer","header":"Name of Insurer(s)","type":"text"},{"key":"remittance","header":"Amount Remitted","type":"money"},{"key":"unremitted","header":"Amount Unremitted","type":"money"},{"key":"remittance_date","header":"Date Remitted/Transferred","type":"date"},{"key":"branch","header":"Originating Location or Branch","type":"text"},{"key":"remarks","header":"Remarks","type":"text"}]'::jsonb,
   '[{"output":"tenor","formula":"cover_to - cover_from (days)"}]'::jsonb,
   '[{"rule":"transaction_type in NEW,RNL,ADD,RTN mapped at export"}]'::jsonb,
   '{"form":"PPS-A","occurrence":"Monthly","totals":["sum_insured","gross_premium","brokerage","net_premium","amount_received"],"number_format":"en-NG"}'::jsonb),
  ('Commission & Rebate Returns', 'CRR', 'QUARTERLY', 'v_crr',
   '[{"key":"date","header":"DATE","type":"date"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"risk_type","header":"RISK TYPE","type":"text"},{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"approved_rate","header":"APPROVED COMMISSION RATE","type":"percent"},{"key":"tax_paid","header":"TAX PAID","type":"money"},{"key":"net_rate","header":"NET COMMISSION RATE","type":"percent"},{"key":"brokerage_commission","header":"BROKERAGE COMMISSION","type":"money"},{"key":"other_deduction","header":"OTHER DEDUCTION","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"amount_received","header":"AMOUNT RECEIVED","type":"money"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[{"output":"net_rate","formula":"(brokerage_commission - tax_paid - other_deduction) / gross_premium * 100"},{"output":"net_premium","formula":"gross_premium - brokerage_commission - other_deduction"}]'::jsonb,
   '[{"rule":"commission = gross x rate verified"},{"rule":"net_premium = gross - commission - other deduction"}]'::jsonb,
   '{"title":"COMMISSION AND REBATE RETURNS (CRR)","totals":["sum_insured","gross_premium","tax_paid","brokerage_commission","other_deduction","net_premium","amount_received"],"number_format":"en-NG"}'::jsonb),
  ('Schedule of Businesses Generated', 'BUSINESSES_GENERATED', 'HALF_YEARLY', 'v_businesses_generated',
   '[{"key":"insured","header":"INSURED","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"insurer","header":"INSURER","type":"text"},{"key":"gp_ngn","header":"GROSS PREMIUM NAIRA","type":"money","currency":"NGN"},{"key":"gp_usd","header":"GROSS PREMIUM DOLLAR","type":"money","currency":"USD"},{"key":"pc_ngn","header":"PREMIUM COLLECTED NAIRA","type":"money","currency":"NGN"},{"key":"pc_usd","header":"PREMIUM COLLECTED DOLLAR","type":"money","currency":"USD"},{"key":"date_collection","header":"DATE OF COLLECTION","type":"date"},{"key":"pp_ngn","header":"PREMIUM PAID NAIRA","type":"money","currency":"NGN"},{"key":"pp_usd","header":"PREMIUM PAID DOLLAR","type":"money","currency":"USD"},{"key":"date_paid","header":"DATE OF PREMIUM PAID","type":"date"},{"key":"comm_ngn","header":"BROKERAGE COMMISSION NAIRA","type":"money","currency":"NGN"},{"key":"comm_usd","header":"BROKERAGE COMMISSION DOLLAR","type":"money","currency":"USD"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"gross_premium stored true (not commission)"},{"rule":"NGN/USD split by currency"}]'::jsonb,
   '{"title":"SCHEDULE OF BUSINESSES GENERATED","totals":["gp_ngn","gp_usd","pc_ngn","pc_usd","pp_ngn","pp_usd","comm_ngn","comm_usd"],"number_format":"en-NG"}'::jsonb),
  ('Personnel Returns', 'PERSONNEL', 'QUARTERLY', 'staff',
   '[{"key":"staff_name","header":"NAME OF STAFF","type":"text"},{"key":"staff_category","header":"STAFF CATEGORY","type":"text"},{"key":"designation","header":"DESIGNATION","type":"text"},{"key":"gender","header":"GENDER","type":"text"},{"key":"educational_qualification","header":"EDUCATIONAL QUALIFICATION","type":"text"},{"key":"professional_qualification","header":"PROFESSIONAL QUALIFICATION","type":"text"},{"key":"date_of_employment","header":"DATE OF EMPLOYMENT","type":"date"},{"key":"state_of_origin","header":"STATE OF ORIGIN","type":"text"},{"key":"location","header":"LOCATION","type":"text"},{"key":"date_of_exit","header":"DATE OF EXIT","type":"date"},{"key":"reason_for_leaving","header":"REASONS FOR LEAVING","type":"text"}]'::jsonb,
   '[{"output":"second_schedule","formula":"previous + entry - exit = current per category"}]'::jsonb,
   '[{"rule":"current = previous + entry - exit"},{"rule":"dates valid ISO"}]'::jsonb,
   '{"title":"PERSONNEL RETURNS","sheets":["FIRST SCHEDULE","SECOND SCHEDULE"],"number_format":"en-NG"}'::jsonb),
  ('Form 1C', 'FORM_1C', 'AD_HOC', 'v_form_1c',
   '[{"key":"insurer","header":"INSURER","type":"text"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"collected","header":"PREMIUM COLLECTED","type":"money"},{"key":"paid","header":"PREMIUM PAID TO INSURER","type":"money"},{"key":"commission","header":"COMMISSION","type":"money"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"totals reconcile to underlying policies"}]'::jsonb,
   '{"title":"NAICOM FORM 1C","totals":["gross_premium","collected","paid","commission"],"number_format":"en-NG"}'::jsonb),
  ('Returns - Insurance Brokerage Commission Register', 'BROKERAGE_COMMISSION', 'ANNUAL', 'v_brokerage_commission',
   '[{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"date","header":"DATE OF POLICY","type":"date"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"commission_rate","header":"COMMISSION RATE","type":"percent"},{"key":"commission_earned","header":"COMMISSION EARNED","type":"money"},{"key":"withholding_tax","header":"WITHHOLDING TAX (WHT)","type":"money"},{"key":"net_commission","header":"NET COMMISSION RECEIVED","type":"money"},{"key":"date_received","header":"DATE COMMISSION RECEIVED","type":"date"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[{"output":"net_commission","formula":"commission_earned - withholding_tax"}]'::jsonb,
   '[{"rule":"commission = gross x rate verified"},{"rule":"net_commission = commission_earned - withholding_tax"}]'::jsonb,
   '{"title":"RETURNS - INSURANCE BROKERAGE COMMISSION REGISTER","occurrence":"Annually","totals":["sum_insured","gross_premium","commission_earned","withholding_tax","net_commission"],"number_format":"en-NG"}'::jsonb),
  ('All New Policies', 'NEW_POLICIES', 'MONTHLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"trans_ref","header":"TRANS. REF.","type":"text"},{"key":"transaction_date","header":"TRANSACTION DATE","type":"date"},{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insured","header":"NAME OF INSURED","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"risk_type","header":"RISK TYPE","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"premium_collected","header":"PREMIUM COLLECTED","type":"money"},{"key":"premium_paid_to_insurer","header":"PREMIUM PAID TO INSURER","type":"money"},{"key":"brokerage_commission","header":"COMMISSION","type":"money"},{"key":"tax","header":"WITHHOLDING TAX","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"premium_due_date","header":"PREMIUM DUE DATE","type":"date"},{"key":"cover_from","header":"COVER FROM","type":"date"},{"key":"cover_to","header":"COVER TO","type":"date"},{"key":"renewal_due_date","header":"RENEWAL DUE DATE","type":"date"},{"key":"premium_collection_date","header":"PREMIUM COLLECTION DATE","type":"date"},{"key":"premium_payment_date","header":"PREMIUM PAYMENT DATE","type":"date"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"bank","header":"BANK OF LODGEMENT","type":"text"},{"key":"currency","header":"CURRENCY","type":"text"},{"key":"branch","header":"BRANCH LOCATION","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"gross_premium >= 0"},{"rule":"premium_due_date = cover_from"}]'::jsonb,
   '{"title":"ALL NEW POLICIES","occurrence":"Monthly","totals":["sum_insured","gross_premium","premium_collected","premium_paid_to_insurer","brokerage_commission","tax","net_premium"],"number_format":"en-NG"}'::jsonb),
  ('All Renewal Policies', 'RENEWAL_POLICIES', 'MONTHLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"policy_no","header":"POLICY NO","type":"text"},{"key":"trans_ref","header":"TRANS. REF.","type":"text"},{"key":"transaction_date","header":"TRANSACTION DATE","type":"date"},{"key":"client","header":"NAME OF CLIENT","type":"text"},{"key":"insured","header":"NAME OF INSURED","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"class_of_business","header":"CLASS OF BUSINESS","type":"text"},{"key":"risk_type","header":"RISK TYPE","type":"text"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"gross_premium","header":"GROSS PREMIUM","type":"money"},{"key":"premium_collected","header":"PREMIUM COLLECTED","type":"money"},{"key":"premium_paid_to_insurer","header":"PREMIUM PAID TO INSURER","type":"money"},{"key":"brokerage_commission","header":"COMMISSION","type":"money"},{"key":"tax","header":"WITHHOLDING TAX","type":"money"},{"key":"net_premium","header":"NET PREMIUM","type":"money"},{"key":"premium_due_date","header":"PREMIUM DUE DATE","type":"date"},{"key":"cover_from","header":"COVER FROM","type":"date"},{"key":"cover_to","header":"COVER TO","type":"date"},{"key":"renewal_due_date","header":"RENEWAL DUE DATE","type":"date"},{"key":"premium_collection_date","header":"PREMIUM COLLECTION DATE","type":"date"},{"key":"premium_payment_date","header":"PREMIUM PAYMENT DATE","type":"date"},{"key":"receipt_no","header":"RECEIPT NO","type":"text"},{"key":"bank","header":"BANK OF LODGEMENT","type":"text"},{"key":"currency","header":"CURRENCY","type":"text"},{"key":"branch","header":"BRANCH LOCATION","type":"text"},{"key":"remarks","header":"REMARKS","type":"text"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"gross_premium >= 0"},{"rule":"premium_due_date = cover_from"}]'::jsonb,
   '{"title":"ALL RENEWAL POLICIES","occurrence":"Monthly","totals":["sum_insured","gross_premium","premium_collected","premium_paid_to_insurer","brokerage_commission","tax","net_premium"],"number_format":"en-NG"}'::jsonb),
  ('Form 7.2B - Statement of Business Generated', 'FORM_7_2B', 'HALF_YEARLY', 'v_income_production',
   '[{"key":"month","header":"MONTH","type":"text"},{"key":"sn","header":"S/N","type":"number"},{"key":"name_of_insured","header":"NAME OF INSURED/POLICY NO.","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"sd","header":"COVER START DATE","type":"date"},{"key":"ed","header":"COVER END DATE","type":"date"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"premium_paid_directly","header":"(a) PREMIUM PAID DIRECTLY TO INSURERS","type":"money"},{"key":"premium_paid_to_brokers_local","header":"(b) PREMIUM PAID TO BROKERS (LOCAL)","type":"money"},{"key":"premium_paid_to_brokers_foreign","header":"(c) PREMIUM PAID TO BROKERS (FOREIGN)","type":"money"},{"key":"total_gross_premium","header":"(d) TOTAL GROSS PREMIUM","type":"money"},{"key":"net_premium","header":"(e) NET PREMIUM","type":"money"},{"key":"clients_bank","header":"PREMIUM IN CLIENTS BANK A/C OR CHEQUE OR CASH","type":"money"},{"key":"date_received","header":"DATE PREMIUM/CLAIMS RECEIVED","type":"date"},{"key":"premium_received_by_broker","header":"PREMIUM RECEIVED BY BROKER FROM INSURED","type":"money"},{"key":"total_commission_fee","header":"TOTAL COMMISSION FEE INCOME","type":"money"},{"key":"commission_due_to_cobrokers","header":"COMMISSION DUE TO CO-BROKERS","type":"money"},{"key":"commission_due_to_reporting","header":"COMMISSION DUE TO REPORTING BROKERS","type":"money"},{"key":"commission_income_earned","header":"COMMISSION INCOME EARNED","type":"money"},{"key":"deferred_commission","header":"DEFERRED COMMISSION INCOME","type":"money"}]'::jsonb,
   '[{"output":"net_premium","formula":"total_gross_premium - total_commission_fee"},{"output":"commission_due_to_reporting","formula":"total_commission_fee - commission_due_to_cobrokers"},{"output":"commission_income_earned","formula":"total_commission_fee * premium_collected / gross_premium"},{"output":"deferred_commission","formula":"total_commission_fee - commission_income_earned"}]'::jsonb,
   '[{"rule":"total_gross_premium = (a) + (b) + (c)"},{"rule":"commission_income_earned + deferred_commission = total_commission_fee"}]'::jsonb,
   '{"title":"FORM 7.2B - STATEMENT OF BUSINESS GENERATED IN THE HALF YEAR","form":"FORM 7.2B","occurrence":"Half-Yearly","totals":["sum_insured","total_gross_premium","net_premium","premium_received_by_broker","total_commission_fee","commission_due_to_cobrokers","commission_due_to_reporting","commission_income_earned","deferred_commission"],"number_format":"en-NG"}'::jsonb),
  ('Form 7.2C - Schedule of Remittances', 'FORM_7_2C', 'HALF_YEARLY', 'v_income_production',
   '[{"key":"month","header":"MONTH","type":"text"},{"key":"sn","header":"S/N","type":"number"},{"key":"name_of_insured","header":"NAME OF INSURED/POLICY NO.","type":"text"},{"key":"insurer","header":"NAME OF INSURER","type":"text"},{"key":"sd","header":"COVER START DATE","type":"date"},{"key":"ed","header":"COVER END DATE","type":"date"},{"key":"total_received","header":"(a) TOTAL PREMIUM/CLAIMS RECEIVED BY THE BROKERS","type":"money"},{"key":"premium_due_to_insurers","header":"(b) PREMIUM DUE TO INSURERS (NET OF VAT)","type":"money"},{"key":"deposit_by_insured","header":"(c) DEPOSIT MADE INTO CLIENTS ACCOUNT BY INSURED","type":"money"},{"key":"returned_premium_due","header":"(d) RETURNED PREMIUM DUE TO INSURED","type":"money"},{"key":"claims_due","header":"(e) CLAIMS DUE TO INSURED","type":"money"},{"key":"vat_due","header":"(f) VAT DUE TO FIRS/SIRS","type":"money"},{"key":"commission_due_cobrokers","header":"(g) COMMISSION DUE TO CO-BROKER(S)","type":"money"},{"key":"commission_due_reporting","header":"(h) COMMISSION DUE TO REPORTING BROKER","type":"money"},{"key":"date_remitted","header":"DATE PREMIUM/CLAIMS/VAT/COMMISSION REMITTED","type":"date"},{"key":"paying_bank","header":"CLIENTS ACCOUNT PAYING BANK","type":"text"},{"key":"premium_remitted","header":"(i) PREMIUM REMITTED TO INSURERS","type":"money"},{"key":"claims_remitted","header":"(j) CLAIMS/RETURNED PREMIUM/DEPOSIT REMITTED TO INSURED","type":"money"},{"key":"vat_remitted","header":"(k) VAT REMITTED TO FIRS/SIRS","type":"money"},{"key":"commission_remitted","header":"(L) COMMISSION REMITTED TO CO-BROKERS AND REPORTING BROKER","type":"money"},{"key":"outstanding_premium","header":"(m) OUTSTANDING PREMIUM DUE TO INSURERS","type":"money"},{"key":"outstanding_claims","header":"(n) OUTSTANDING CLAIMS/RETURNED PREMIUM/DEPOSIT DUE TO INSURED","type":"money"},{"key":"outstanding_vat","header":"(o) OUTSTANDING VAT DUE TO FIRS/SIRS","type":"money"},{"key":"outstanding_commission","header":"(p) OUTSTANDING COMMISSION DUE TO CO-BROKERS AND REPORTING BROKER","type":"money"}]'::jsonb,
   '[{"output":"outstanding_premium","formula":"premium_due_to_insurers - premium_remitted"},{"output":"outstanding_claims","formula":"deposit_by_insured + returned_premium_due + claims_due - claims_remitted"},{"output":"outstanding_vat","formula":"vat_due - vat_remitted"},{"output":"outstanding_commission","formula":"commission_due_cobrokers + commission_due_reporting - commission_remitted"}]'::jsonb,
   '[{"rule":"outstanding_premium = (b) - (i)"},{"rule":"outstanding_commission = (g) + (h) - (L)"}]'::jsonb,
   '{"title":"FORM 7.2C - SCHEDULE OF REMITTANCES IN RESPECT OF BUSINESS GENERATED IN THE HALF YEAR","form":"FORM 7.2C","occurrence":"Half-Yearly","totals":["total_received","premium_due_to_insurers","commission_due_reporting","premium_remitted","commission_remitted","outstanding_premium","outstanding_commission"],"number_format":"en-NG"}'::jsonb),
  ('Schedule of Claims Awaiting Payment', 'CLAIMS_AWAITING', 'QUARTERLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"date_notified_by_insured","header":"DATE OF CLAIM NOTIFICATION BY INSURED","type":"date"},{"key":"date_notified_to_insurer","header":"DATE OF CLAIM NOTIFICATION TO INSURER","type":"date"},{"key":"insurer_name","header":"NAME OF INSURER","type":"text"},{"key":"claim_no","header":"CLAIM NO.","type":"text"},{"key":"claim_amount","header":"CLAIM AMOUNT","type":"money"},{"key":"date_discharge_voucher","header":"DATE OF RECEIPT OF DISCHARGE VOUCHER","type":"date"},{"key":"insured_beneficiary","header":"NAME OF INSURED/BENEFICIARY","type":"text"},{"key":"date_payment","header":"DATE OF PAYMENT BY INSURER","type":"text"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"claim_amount >= 0"}]'::jsonb,
   '{"title":"SCHEDULE OF CLAIMS AWAITING PAYMENT","occurrence":"Quarterly","totals":["claim_amount"],"number_format":"en-NG"}'::jsonb),
  ('Business Schedule and Premium Transmission', 'BIZ_SCHEDULE', 'QUARTERLY', 'policies',
   '[{"key":"sn","header":"S/N","type":"number"},{"key":"insured_name","header":"NAME OF INSURED","type":"text"},{"key":"insurer_name","header":"NAME OF INSURER","type":"text"},{"key":"policy_no","header":"POLICY NO.","type":"text"},{"key":"policy_detail","header":"POLICY DETAIL","type":"text"},{"key":"commencement_of_risk","header":"COMMENCEMENT OF RISK","type":"date"},{"key":"sum_insured","header":"SUM INSURED","type":"money"},{"key":"premium_local","header":"PREMIUM (LOCAL)","type":"money","currency":"NGN"},{"key":"premium_foreign","header":"PREMIUM (FOREIGN)","type":"money","currency":"USD"},{"key":"date_received","header":"DATE OF RECEIPT OF PREMIUM","type":"date"},{"key":"date_transmitted","header":"DATE OF TRANSMISSION OF PREMIUM","type":"date"},{"key":"commission_local","header":"COMMISSION (LOCAL)","type":"money","currency":"NGN"},{"key":"commission_foreign","header":"COMMISSION (FOREIGN)","type":"money","currency":"USD"}]'::jsonb,
   '[]'::jsonb,
   '[{"rule":"premium_local >= 0"},{"rule":"premium_foreign >= 0"}]'::jsonb,
   '{"title":"BUSINESS SCHEDULE AND PREMIUM TRANSMISSION","occurrence":"Quarterly","totals":["sum_insured","premium_local","premium_foreign","commission_local","commission_foreign"],"number_format":"en-NG"}'::jsonb)
on conflict (code) do nothing;

-- Return definitions (catalogue) -----------------------------------
insert into public.return_definitions (name, code, form_number, frequency, responsible_department, data_source, template_id, active, requires_confirmation)
select v.name, v.code, v.form_number, v.frequency, v.responsible_department, v.data_source, t.id, v.active, v.requires_confirmation
from (values
  ('Income Production','INCOME_PRODUCTION',null,'MONTHLY','Operations/Finance','v_income_production','INCOME_PRODUCTION',true,false),
  ('Premium Income/Production Schedule (PPS-A)','PPS','PPS-A','MONTHLY','Finance','v_income_production','PPS',true,false),
  ('Commission & Rebate Returns','CRR',null,'QUARTERLY','Finance','v_crr','CRR',true,false),
  ('Schedule of Businesses Generated','BUSINESSES_GENERATED',null,'HALF_YEARLY','Operations','v_businesses_generated','BUSINESSES_GENERATED',true,false),
  ('Personnel Returns','PERSONNEL',null,'QUARTERLY','HR','staff','PERSONNEL',true,false),
  ('Form 1C','FORM_1C','NAICOM Form 1C','AD_HOC','Finance','v_form_1c','FORM_1C',true,false),
  ('Returns - Insurance Brokerage Commission Register','BROKERAGE_COMMISSION',null,'ANNUAL','Finance','v_brokerage_commission','BROKERAGE_COMMISSION',true,false),
  ('All New Policies','NEW_POLICIES',null,'MONTHLY','Operations','policies','NEW_POLICIES',true,false),
  ('All Renewal Policies','RENEWAL_POLICIES',null,'MONTHLY','Operations','policies','RENEWAL_POLICIES',true,false),
  ('Form 7.2B - Statement of Business Generated','FORM_7_2B','FORM 7.2B','HALF_YEARLY','Operations/Finance','v_income_production','FORM_7_2B',true,false),
  ('Form 7.2C - Schedule of Remittances','FORM_7_2C','FORM 7.2C','HALF_YEARLY','Finance','v_income_production','FORM_7_2C',true,false),
  ('Schedule of Claims Awaiting Payment','CLAIMS_AWAITING',null,'QUARTERLY','Operations','policies','CLAIMS_AWAITING',true,false),
  ('Business Schedule and Premium Transmission','BIZ_SCHEDULE',null,'QUARTERLY','Operations/Finance','policies','BIZ_SCHEDULE',true,false)
) as v(name, code, form_number, frequency, responsible_department, data_source, tpl_code, active, requires_confirmation)
left join public.return_templates t on t.code = v.tpl_code
on conflict (code) do nothing;

-- Due-date rules (configurable NAICOM deadlines, PRD §42) ---------
insert into public.due_date_rules (definition_id, rule, effective_from, confirmed, source)
select d.id, r.rule, r.effective_from, r.confirmed, r.source
from (values
  ('INCOME_PRODUCTION','{"frequency":"MONTHLY","day_of_month":15}'::jsonb,'2026-01-01',true,'NAICOM monthly returns guideline'),
  ('PPS','{"frequency":"MONTHLY","day_of_month":15}'::jsonb,'2026-01-01',true,'NAICOM monthly returns guideline'),
  ('CRR','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM quarterly returns directive'),
  ('BUSINESSES_GENERATED','{"frequency":"HALF_YEARLY","days_after_period_end":30}'::jsonb,'2026-01-01',true,'NAICOM half-yearly returns directive'),
  ('PERSONNEL','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM personnel returns directive'),
  ('FORM_1C','{"frequency":"AD_HOC","fixed_date":"2026-03-31"}'::jsonb,'2026-01-01',false,'NAICOM circular — deadline to be confirmed'),
  ('BROKERAGE_COMMISSION','{"frequency":"ANNUAL","due_month":1,"due_day":31}'::jsonb,'2026-01-01',true,'NAICOM annual returns — due 31 January of the following year'),
  ('FORM_7_2B','{"frequency":"HALF_YEARLY","days_after_period_end":30}'::jsonb,'2026-01-01',true,'NAICOM half-yearly returns directive'),
  ('FORM_7_2C','{"frequency":"HALF_YEARLY","days_after_period_end":30}'::jsonb,'2026-01-01',true,'NAICOM half-yearly returns directive'),
  ('CLAIMS_AWAITING','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM quarterly claims returns directive'),
  ('BIZ_SCHEDULE','{"frequency":"QUARTERLY","days_after_period_end":21}'::jsonb,'2026-01-01',true,'NAICOM quarterly business schedule directive')
) as r(def_code, rule, effective_from, confirmed, source)
join public.return_definitions d on d.code = r.def_code;

-- Link templates to their due-date rules --------------------------
update public.return_templates t
set due_rule_id = dr.id
from public.due_date_rules dr
join public.return_definitions d on d.id = dr.definition_id
where d.template_id = t.id;

-- Reconciliation rules (pre-configured cross-return checks) -------
insert into public.reconciliation_rules (name, source_a, source_b, threshold, active) values
  ('Commission consistency — CRR vs Income Production','{"definition_code":"CRR","column":"brokerage_commission"}'::jsonb,'{"definition_code":"INCOME_PRODUCTION","column":"brokerage"}'::jsonb,0.01,true),
  ('Premium consistency — Businesses Generated vs Income Production','{"definition_code":"BUSINESSES_GENERATED","column":"gp_ngn"}'::jsonb,'{"definition_code":"INCOME_PRODUCTION","column":"gross_premium"}'::jsonb,0.01,true),
  ('Form 1C integrity — totals vs underlying policies','{"definition_code":"FORM_1C","column":"gross_premium"}'::jsonb,'{"source":"policies","column":"gross_premium"}'::jsonb,0.01,true),
  ('Collection sanity — policy collections vs policies','{"source":"policy_collections","column":"amount"}'::jsonb,'{"source":"policies","column":"premium_collected"}'::jsonb,0.01,true),
  ('Remittance sanity — policy remittances vs policies','{"source":"policy_remittances","column":"amount"}'::jsonb,'{"source":"policies","column":"premium_paid_to_insurer"}'::jsonb,0.01,true),
  ('Commission register — Brokerage Commission Register vs CRR','{"definition_code":"BROKERAGE_COMMISSION","column":"commission_earned"}'::jsonb,'{"definition_code":"CRR","column":"brokerage_commission"}'::jsonb,0.01,true),
  ('Commission vs rate — policies vs commission rate × gross','{"source":"policies","column":"brokerage_commission"}'::jsonb,'{"source":"policies","column":"commission_rate * gross_premium"}'::jsonb,1,true);

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
