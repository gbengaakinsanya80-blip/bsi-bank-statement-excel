import { demoPolicies } from "@/lib/demo/data";
import { listStoredDemoPolicies } from "@/lib/demo/policy-store";
import type { PolicySource } from "@/lib/returns/types";

const DEMO_BANKS: Record<string, string> = {
  "pol-1": "Fidelity Bank",
  "pol-2": "GTBank",
  "pol-3": "Zenith Bank",
  "pol-4": "Fidelity Bank",
  "pol-5": "GTBank",
  "pol-6": "First Bank",
  "pol-7": "Zenith Bank",
  "pol-8": "First Bank",
};

function toSource(p: {
  id: string;
  transaction_reference: string | null;
  policy_number: string | null;
  endorsement_number: string | null;
  transaction_type: string;
  risk_type: string | null;
  class_of_business: string | null;
  insured_name: string | null;
  client_id: string | null;
  insurer_id: string | null;
  broker_or_agent: string | null;
  ledger_account: string | null;
  sum_insured: string | null;
  currency: string;
  gross_premium: string | null;
  premium_collected: string | null;
  premium_paid_to_insurer: string | null;
  brokerage_commission: string | null;
  commission_rate: string | null;
  tax: string | null;
  other_deductions: string | null;
  net_premium: string | null;
  amount_received: string | null;
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
  clients?: { client_name: string } | null;
  insurers?: { insurer_name: string } | null;
  bank_name?: string | null;
}): PolicySource {
  return {
    id: p.id,
    transaction_reference: p.transaction_reference,
    policy_number: p.policy_number,
    endorsement_number: p.endorsement_number,
    transaction_type: p.transaction_type,
    risk_type: p.risk_type,
    class_of_business: p.class_of_business,
    insured_name: p.insured_name,
    client_name: p.clients?.client_name ?? null,
    insurer_name: p.insurers?.insurer_name ?? null,
    broker_or_agent: p.broker_or_agent,
    ledger_account: p.ledger_account,
    sum_insured: p.sum_insured ? Number(p.sum_insured) : null,
    currency: p.currency,
    gross_premium: p.gross_premium ? Number(p.gross_premium) : null,
    premium_collected: p.premium_collected ? Number(p.premium_collected) : null,
    premium_paid_to_insurer: p.premium_paid_to_insurer ? Number(p.premium_paid_to_insurer) : null,
    brokerage_commission: p.brokerage_commission ? Number(p.brokerage_commission) : null,
    commission_rate: p.commission_rate ? Number(p.commission_rate) : null,
    tax: p.tax ? Number(p.tax) : null,
    other_deductions: p.other_deductions ? Number(p.other_deductions) : null,
    net_premium: p.net_premium ? Number(p.net_premium) : null,
    amount_received: p.amount_received ? Number(p.amount_received) : null,
    receipt_number: p.receipt_number,
    debit_note_number: p.debit_note_number,
    credit_note_number: p.credit_note_number,
    transaction_date: p.transaction_date,
    cover_from: p.cover_from,
    cover_to: p.cover_to,
    premium_collection_date: p.premium_collection_date,
    premium_payment_date: p.premium_payment_date,
    branch_location: p.branch_location,
    remarks: p.remarks,
    bank_name: p.bank_name ?? DEMO_BANKS[p.id] ?? null,
    cheque_number: null,
  };
}

export async function demoPolicySources(): Promise<PolicySource[]> {
  const stored = await listStoredDemoPolicies();
  return [...demoPolicies, ...stored].map(toSource);
}
