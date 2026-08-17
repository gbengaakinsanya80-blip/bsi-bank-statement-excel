import type { DbClient } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import { buildReturnRows } from "@/lib/returns/builders";
import { getReturnDefinition } from "@/lib/returns/definitions";
import { buildPeriod } from "@/lib/returns/periods";
import { upsertDemoReturn } from "@/lib/returns/demo-store";
import { demoStaff, demoStaffCategories } from "@/lib/demo/data";
import { demoPolicySources } from "@/lib/demo/policy-sources";
import type {
  PolicySource,
  ReturnData,
  StaffSource,
} from "@/lib/returns/types";

export interface GenerateResult {
  id: string;
  code: string;
  periodLabel: string;
  rowCount: number;
  existing: boolean;
  version: number;
}

async function demoReturnData(): Promise<ReturnData> {
  const policies: PolicySource[] = await demoPolicySources();

  const staff: StaffSource[] = demoStaff.map((s) => ({
    id: s.id,
    staff_name: s.staff_name,
    staff_category:
      demoStaffCategories.find((c) => c.id === s.staff_category_id)?.name ?? null,
    designation: s.designation,
    gender: s.gender,
    educational_qualification: s.educational_qualification,
    professional_qualification: s.professional_qualification,
    date_of_employment: s.date_of_employment,
    state_of_origin: s.state_of_origin,
    location: s.location,
    date_of_exit: s.date_of_exit,
    reason_for_leaving: s.reason_for_leaving,
  }));

  return { policies, staff, claims: [] };
}

function toPolicySource(p: {
  id: string;
  transaction_reference: string | null;
  policy_number: string | null;
  endorsement_number: string | null;
  transaction_type: string;
  risk_type: string | null;
  class_of_business: string | null;
  insured_name: string | null;
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
  clients?: { client_name: string | null } | null;
  insurers?: { insurer_name: string | null } | null;
  policy_collections?: { bank_name: string | null; cheque_number: string | null }[] | null;
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
    bank_name: p.policy_collections?.[0]?.bank_name ?? null,
    cheque_number: p.policy_collections?.[0]?.cheque_number ?? null,
  };
}

async function loadReturnData(supabase: DbClient, code: string): Promise<ReturnData> {
  if (code === "PERSONNEL") {
    const { data, error } = await supabase
      .from("staff")
      .select("*, staff_categories(name)")
      .is("deleted_at", null)
      .eq("is_demo", false);
    if (error) throw new Error(error.message);
    const staff: StaffSource[] = (data ?? []).map((s) => ({
      id: s.id,
      staff_name: s.staff_name,
      staff_category: s.staff_categories?.name ?? null,
      designation: s.designation,
      gender: s.gender,
      educational_qualification: s.educational_qualification,
      professional_qualification: s.professional_qualification,
      date_of_employment: s.date_of_employment,
      state_of_origin: s.state_of_origin,
      location: s.location,
      date_of_exit: s.date_of_exit,
      reason_for_leaving: s.reason_for_leaving,
    }));
    return { policies: [], staff, claims: [] };
  }

  const { data, error } = await supabase
    .from("policies")
    .select(
      `*,
      clients(client_name),
      insurers(insurer_name),
      policy_collections(bank_name, cheque_number)`
    )
    .is("deleted_at", null)
    .eq("is_demo", false);
  if (error) throw new Error(error.message);
  return { policies: (data ?? []).map(toPolicySource), staff: [], claims: [] };
}

async function ensureDefinitionId(supabase: DbClient, code: string): Promise<string> {
  const { data, error } = await supabase
    .from("return_definitions")
    .select("id")
    .eq("code", code)
    .single();
  if (error) {
    throw new Error(
      `Return definition "${code}" not found. Run supabase/seed.sql to load the return catalogue.`
    );
  }
  return data.id;
}

export async function generateReturn(
  code: string,
  periodKey: string,
  userId: string
): Promise<GenerateResult> {
  const definition = getReturnDefinition(code);
  const period = buildPeriod(definition.frequency, periodKey);

  if (!isSupabaseConfigured) {
    const data = await demoReturnData();
    const rows = buildReturnRows(code, data, period);
    const { id, existing, version } = await upsertDemoReturn(code, period, rows);
    return { id, code, periodLabel: period.label, rowCount: rows.length, existing, version };
  }

  const supabase = await createServerSupabase();
  if (!supabase) throw new Error("Supabase is not configured.");
  const definitionId = await ensureDefinitionId(supabase, code);

  const data = await loadReturnData(supabase, code);
  const rows = buildReturnRows(code, data, period);

  const { data: found } = await supabase
    .from("returns")
    .select("id")
    .eq("definition_id", definitionId)
    .eq("period_start", period.start)
    .eq("period_end", period.end)
    .maybeSingle();

  if (found) {
    const { data: maxRow } = await supabase
      .from("return_versions")
      .select("version_no")
      .eq("return_id", found.id)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = (maxRow?.version_no ?? 0) + 1;

    const { data: version, error: versionError } = await supabase
      .from("return_versions")
      .insert({
        return_id: found.id,
        version_no: nextVersion,
        status: "AMENDED",
        snapshot: rows,
        created_by: userId,
      })
      .select("id")
      .single();
    if (versionError) throw new Error(versionError.message);

    const { error: deleteError } = await supabase
      .from("return_line_items")
      .delete()
      .eq("return_id", found.id);
    if (deleteError) throw new Error(deleteError.message);

    if (rows.length > 0) {
      const { error: linesError } = await supabase.from("return_line_items").insert(
        rows.map((row) => ({ return_id: found.id, version_id: version.id, row_data: row }))
      );
      if (linesError) throw new Error(linesError.message);
    }

    await supabase.from("returns").update({ status: "DRAFT" }).eq("id", found.id);

    return {
      id: found.id,
      code,
      periodLabel: period.label,
      rowCount: rows.length,
      existing: true,
      version: nextVersion,
    };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("returns")
    .insert({
      definition_id: definitionId,
      period_label: period.label,
      period_start: period.start,
      period_end: period.end,
      status: "DRAFT",
      created_by: userId,
    })
    .select("id")
    .single();

  if (insertError && insertError.code === "23505") {
    const { data: existing } = await supabase
      .from("returns")
      .select("id")
      .eq("definition_id", definitionId)
      .eq("period_start", period.start)
      .eq("period_end", period.end)
      .single();
    if (!existing) throw new Error(insertError.message);
    return {
      id: existing.id,
      code,
      periodLabel: period.label,
      rowCount: rows.length,
      existing: true,
      version: 1,
    };
  }
  if (insertError) throw new Error(insertError.message);
  const returnId = inserted.id;

  const { data: version, error: versionError } = await supabase
    .from("return_versions")
    .insert({
      return_id: returnId,
      version_no: 1,
      status: "DRAFT",
      snapshot: rows,
      created_by: userId,
    })
    .select("id")
    .single();
  if (versionError) throw new Error(versionError.message);

  if (rows.length > 0) {
    const { error: linesError } = await supabase.from("return_line_items").insert(
      rows.map((row) => ({ return_id: returnId, version_id: version.id, row_data: row }))
    );
    if (linesError) throw new Error(linesError.message);
  }

  return {
    id: returnId,
    code,
    periodLabel: period.label,
    rowCount: rows.length,
    existing: false,
    version: 1,
  };
}
