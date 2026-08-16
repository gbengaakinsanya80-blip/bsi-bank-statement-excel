"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  coerceDates,
  policySchema,
  toPolicyRow,
} from "@/lib/services/policy-service";
import { saveStoredDemoPolicy } from "@/lib/demo/policy-store";
import { demoClients, demoInsurers } from "@/lib/demo/data";

export type PolicyActionState = { error?: string; fieldErrors?: Record<string, string[]> } | null;

function fmt(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

export async function createPolicyAction(
  _prevState: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const user = await requireUser();

  const raw: Record<string, unknown> = {
    policy_number: formData.get("policy_number"),
    endorsement_number: formData.get("endorsement_number"),
    transaction_type: formData.get("transaction_type") || "NEW",
    new_or_renewal: formData.get("new_or_renewal") || null,
    client_id: formData.get("client_id") || null,
    insured_name: formData.get("insured_name"),
    insurer_id: formData.get("insurer_id") || null,
    broker_or_agent: formData.get("broker_or_agent"),
    ledger_account: formData.get("ledger_account"),
    risk_type: formData.get("risk_type"),
    class_of_business: formData.get("class_of_business"),
    currency: formData.get("currency") || "NGN",
    sum_insured: formData.get("sum_insured") || null,
    gross_premium: formData.get("gross_premium") || null,
    premium_collected: formData.get("premium_collected") || null,
    premium_paid_to_insurer: formData.get("premium_paid_to_insurer") || null,
    brokerage_commission: formData.get("brokerage_commission") || null,
    commission_rate: formData.get("commission_rate") || null,
    tax: formData.get("tax") || null,
    other_deductions: formData.get("other_deductions") || null,
    net_premium: formData.get("net_premium") || null,
    amount_received: formData.get("amount_received") || null,
    receipt_number: formData.get("receipt_number"),
    debit_note_number: formData.get("debit_note_number"),
    credit_note_number: formData.get("credit_note_number"),
    transaction_date: formData.get("transaction_date") || null,
    cover_from: formData.get("cover_from") || null,
    cover_to: formData.get("cover_to") || null,
    premium_collection_date: formData.get("premium_collection_date") || null,
    premium_payment_date: formData.get("premium_payment_date") || null,
    branch_location: formData.get("branch_location"),
    remarks: formData.get("remarks"),
  };

  const parsed = policySchema.safeParse(coerceDates(raw));
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const data = parsed.data;
    const client = demoClients.find((c) => c.id === data.client_id);
    const insurer = demoInsurers.find((i) => i.id === data.insurer_id);
    const now = new Date().toISOString();
    const id = `demo-policy-${Date.now()}`;
    await saveStoredDemoPolicy({
      id,
      transaction_reference: `TRX-${data.policy_number}`,
      policy_number: data.policy_number,
      endorsement_number: fmt(data.endorsement_number),
      transaction_type: data.transaction_type,
      new_or_renewal: data.new_or_renewal ?? null,
      risk_type: fmt(data.risk_type),
      class_of_business: fmt(data.class_of_business),
      client_id: data.client_id ?? null,
      insured_name: fmt(data.insured_name),
      insurer_id: data.insurer_id ?? null,
      broker_or_agent: fmt(data.broker_or_agent),
      ledger_account: fmt(data.ledger_account),
      sum_insured: fmt(data.sum_insured),
      currency: data.currency,
      gross_premium: fmt(data.gross_premium),
      premium_collected: fmt(data.premium_collected),
      premium_paid_to_insurer: fmt(data.premium_paid_to_insurer),
      brokerage_commission: fmt(data.brokerage_commission),
      commission_rate: fmt(data.commission_rate),
      tax: fmt(data.tax),
      other_deductions: fmt(data.other_deductions),
      net_premium: fmt(data.net_premium),
      amount_received: fmt(data.amount_received),
      receipt_number: fmt(data.receipt_number),
      debit_note_number: fmt(data.debit_note_number),
      credit_note_number: fmt(data.credit_note_number),
      transaction_date: data.transaction_date ?? null,
      cover_from: data.cover_from ?? null,
      cover_to: data.cover_to ?? null,
      premium_collection_date: data.premium_collection_date ?? null,
      premium_payment_date: data.premium_payment_date ?? null,
      branch_location: fmt(data.branch_location),
      remarks: fmt(data.remarks),
      status: "ACTIVE",
      is_demo: true,
      created_by: user.id,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      clients: client ? { client_name: client.client_name } : null,
      insurers: insurer ? { insurer_name: insurer.insurer_name } : null,
    });
    redirect("/policies");
  }

  const { error } = await supabase.from("policies").insert(toPolicyRow(parsed.data, user.id));
  if (error) {
    if (error.code === "23505") {
      return { error: "A policy with these details already exists. Check for a duplicate." };
    }
    return { error: error.message };
  }

  redirect("/policies");
}
