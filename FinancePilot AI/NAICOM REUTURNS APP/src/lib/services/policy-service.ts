import { z } from "zod";
import type { Policy } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export const policySchema = z.object({
  policy_number: z.string().trim().min(1, "Policy number is required").max(100),
  endorsement_number: z.string().trim().max(50).optional().nullable(),
  transaction_type: z
    .enum(["NEW", "RENEWAL", "ENDORSEMENT", "DEBIT_NOTE", "CREDIT_NOTE", "CANCELLATION"])
    .default("NEW"),
  new_or_renewal: z.enum(["NEW", "RENEWAL"]).optional().nullable(),
  client_id: z.string().trim().optional().nullable(),
  insured_name: z.string().trim().max(200).optional().nullable(),
  insurer_id: z.string().trim().optional().nullable(),
  broker_or_agent: z.string().trim().max(200).optional().nullable(),
  ledger_account: z.string().trim().max(100).optional().nullable(),
  risk_type: z.string().trim().max(100).optional().nullable(),
  class_of_business: z.string().trim().max(100).optional().nullable(),
  currency: z.string().length(3).default("NGN"),
  sum_insured: z.coerce.number().min(0).optional().nullable(),
  gross_premium: z.coerce.number().min(0).optional().nullable(),
  premium_collected: z.coerce.number().min(0).optional().nullable(),
  premium_paid_to_insurer: z.coerce.number().min(0).optional().nullable(),
  brokerage_commission: z.coerce.number().min(0).optional().nullable(),
  commission_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  tax: z.coerce.number().min(0).optional().nullable(),
  other_deductions: z.coerce.number().min(0).optional().nullable(),
  net_premium: z.coerce.number().min(0).optional().nullable(),
  amount_received: z.coerce.number().min(0).optional().nullable(),
  receipt_number: z.string().trim().max(100).optional().nullable(),
  debit_note_number: z.string().trim().max(100).optional().nullable(),
  credit_note_number: z.string().trim().max(100).optional().nullable(),
  transaction_date: z.string().date().optional().nullable(),
  cover_from: z.string().date().optional().nullable(),
  cover_to: z.string().date().optional().nullable(),
  premium_collection_date: z.string().date().optional().nullable(),
  premium_payment_date: z.string().date().optional().nullable(),
  branch_location: z.string().trim().max(200).optional().nullable(),
  remarks: z.string().trim().max(1000).optional().nullable(),
});

export type PolicyInput = z.input<typeof policySchema>;
export type PolicyOutput = z.output<typeof policySchema>;

export function coerceDates(input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  for (const key of [
    "transaction_date",
    "cover_from",
    "cover_to",
    "premium_collection_date",
    "premium_payment_date",
  ]) {
    const v = out[key];
    if (v === null || v === undefined || v === "") out[key] = null;
  }
  return out;
}

export function toPolicyRow(input: PolicyOutput, userId: string) {
  const row: Record<string, unknown> = { ...input, created_by: userId };
  for (const key of [
    "sum_insured",
    "gross_premium",
    "premium_collected",
    "premium_paid_to_insurer",
    "brokerage_commission",
    "commission_rate",
    "tax",
    "other_deductions",
    "net_premium",
    "amount_received",
  ]) {
    if (row[key] === undefined || row[key] === null || row[key] === "") row[key] = null;
  }
  return row;
}

export async function listPolicies(supabase: DbClient, limit = 100): Promise<(Policy & { clients: { client_name: string } | null; insurers: { insurer_name: string } | null })[]> {
  try {
    const { data, error } = await supabase
      .from("policies")
      .select(
        `*,
        clients(client_name),
        insurers(insurer_name)`
      )
      .is("deleted_at", null)
      .eq("is_demo", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as (Policy & { clients: { client_name: string } | null; insurers: { insurer_name: string } | null })[];
  } catch {
    return [];
  }
}

export async function getPolicy(supabase: DbClient, id: string) {
  const { data, error } = await supabase
    .from("policies")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data as Policy;
}
