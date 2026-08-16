import { saveStoredDemoPolicy, type StoredDemoPolicy } from "@/lib/demo/policy-store";
import { demoClients, demoInsurers } from "@/lib/demo/data";
import type { DbClient } from "@/lib/supabase/server";

function fmt(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export function recordToStoredPolicy(
  record: Record<string, unknown>,
  userId: string
): StoredDemoPolicy {
  const client = demoClients.find((c) => c.client_name === record.client_name);
  const insurer = demoInsurers.find((i) => i.insurer_name === record.insurer_name);
  const now = new Date().toISOString();
  return {
    id: `demo-policy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    transaction_reference: `TRX-${record.policy_number ?? ""}`,
    policy_number: fmt(record.policy_number),
    endorsement_number: fmt(record.endorsement_number),
    transaction_type: (record.transaction_type as StoredDemoPolicy["transaction_type"]) ?? "NEW",
    new_or_renewal: null,
    risk_type: fmt(record.risk_type),
    class_of_business: fmt(record.class_of_business),
    client_id: client?.id ?? null,
    insured_name: fmt(record.insured_name),
    insurer_id: insurer?.id ?? null,
    broker_or_agent: fmt(record.broker_or_agent),
    ledger_account: fmt(record.ledger_account),
    sum_insured: fmt(record.sum_insured),
    currency: (record.currency as string) ?? "NGN",
    gross_premium: fmt(record.gross_premium),
    premium_collected: fmt(record.premium_collected),
    premium_paid_to_insurer: fmt(record.premium_paid_to_insurer),
    brokerage_commission: fmt(record.brokerage_commission),
    commission_rate: fmt(record.commission_rate),
    tax: fmt(record.tax),
    other_deductions: fmt(record.other_deductions),
    net_premium: fmt(record.net_premium),
    amount_received: fmt(record.amount_received),
    receipt_number: fmt(record.receipt_number),
    debit_note_number: fmt(record.debit_note_number),
    credit_note_number: fmt(record.credit_note_number),
    transaction_date: fmt(record.transaction_date),
    cover_from: fmt(record.cover_from),
    cover_to: fmt(record.cover_to),
    premium_collection_date: fmt(record.premium_collection_date),
    premium_payment_date: fmt(record.premium_payment_date),
    branch_location: fmt(record.branch_location),
    remarks: fmt(record.remarks),
    status: "ACTIVE",
    is_demo: true,
    created_by: userId,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    clients: client ? { client_name: client.client_name } : { client_name: fmt(record.client_name) ?? "" },
    insurers: insurer ? { insurer_name: insurer.insurer_name } : { insurer_name: fmt(record.insurer_name) ?? "" },
  };
}

export async function persistRecords(
  records: Record<string, unknown>[],
  userId: string,
  supabase: DbClient | null
): Promise<{ count: number; mode: "demo" | "live" }> {
  if (!supabase) {
    for (const record of records) {
      await saveStoredDemoPolicy(recordToStoredPolicy(record, userId));
    }
    return { count: records.length, mode: "demo" };
  }

  for (const record of records) {
    const { error } = await supabase.from("policies").insert({
      policy_number: fmt(record.policy_number),
      endorsement_number: fmt(record.endorsement_number),
      transaction_type: record.transaction_type ?? "NEW",
      insured_name: fmt(record.insured_name),
      broker_or_agent: fmt(record.broker_or_agent),
      ledger_account: fmt(record.ledger_account),
      risk_type: fmt(record.risk_type),
      class_of_business: fmt(record.class_of_business),
      currency: record.currency ?? "NGN",
      sum_insured: fmt(record.sum_insured),
      gross_premium: fmt(record.gross_premium),
      premium_collected: fmt(record.premium_collected),
      premium_paid_to_insurer: fmt(record.premium_paid_to_insurer),
      brokerage_commission: fmt(record.brokerage_commission),
      commission_rate: fmt(record.commission_rate),
      tax: fmt(record.tax),
      other_deductions: fmt(record.other_deductions),
      net_premium: fmt(record.net_premium),
      amount_received: fmt(record.amount_received),
      receipt_number: fmt(record.receipt_number),
      debit_note_number: fmt(record.debit_note_number),
      credit_note_number: fmt(record.credit_note_number),
      transaction_date: fmt(record.transaction_date),
      cover_from: fmt(record.cover_from),
      cover_to: fmt(record.cover_to),
      premium_collection_date: fmt(record.premium_collection_date),
      premium_payment_date: fmt(record.premium_payment_date),
      branch_location: fmt(record.branch_location),
      remarks: fmt(record.remarks),
      created_by: userId,
    });
    if (error) throw new Error(error.message);
  }
  return { count: records.length, mode: "live" };
}
