import type { ReturnFrequency } from "@/lib/returns/definitions";
import type { ValidationResult } from "@/lib/compliance/validation";

/** A policy enriched with joined names + the first collection's bank details. */
export interface PolicySource {
  id: string;
  transaction_reference: string | null;
  policy_number: string | null;
  endorsement_number: string | null;
  transaction_type: string;
  risk_type: string | null;
  class_of_business: string | null;
  insured_name: string | null;
  client_name: string | null;
  insurer_name: string | null;
  broker_or_agent: string | null;
  ledger_account: string | null;
  sum_insured: number | null;
  currency: string;
  gross_premium: number | null;
  premium_collected: number | null;
  premium_paid_to_insurer: number | null;
  brokerage_commission: number | null;
  commission_rate: number | null;
  tax: number | null;
  other_deductions: number | null;
  net_premium: number | null;
  amount_received: number | null;
  receipt_number: string | null;
  debit_note_number: string | null;
  credit_note_number: string | null;
  transaction_date: string | null;
  cover_from: string | null;
  cover_to: string | null;
  premium_collection_date: string | null;
  premium_payment_date: string | null;
  branch_location: string | null;
  remarks: string | null;
  bank_name: string | null;
  cheque_number: string | null;
}

export interface StaffSource {
  id: string;
  staff_name: string;
  staff_category: string | null;
  designation: string | null;
  gender: string | null;
  educational_qualification: string | null;
  professional_qualification: string | null;
  date_of_employment: string | null;
  state_of_origin: string | null;
  location: string | null;
  date_of_exit: string | null;
  reason_for_leaving: string | null;
}

export interface ClaimSource {
  id: string;
  date_notified_by_insured: string | null;
  date_notified_to_insurer: string | null;
  insurer_name: string | null;
  claim_no: string | null;
  claim_amount: number | null;
  date_discharge_voucher: string | null;
  insured_beneficiary: string | null;
  date_payment: string | null;
  remarks: string | null;
}

export interface ReturnData {
  policies: PolicySource[];
  staff: StaffSource[];
  claims: ClaimSource[];
}

export type ReturnRow = Record<string, unknown>;

export interface ReturnTotal {
  label: string;
  value: number;
  currency?: string;
}

export interface ReturnInstanceView {
  id: string;
  code: string;
  name: string;
  formNumber: string | null;
  frequency: ReturnFrequency;
  department: string;
  periodKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
  rowCount: number;
  versionNo: number;
  rows: ReturnRow[];
  totals: ReturnTotal[];
  quality: ValidationResult | null;
}

export interface ReturnInstanceSummary {
  id: string;
  code: string;
  name: string;
  formNumber: string | null;
  frequency: ReturnFrequency;
  department: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  createdAt: string;
  rowCount: number;
  versionNo: number;
  qualityScore: number | null;
}
