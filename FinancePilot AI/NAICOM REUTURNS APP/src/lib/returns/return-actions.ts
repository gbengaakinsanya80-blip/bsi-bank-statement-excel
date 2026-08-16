"use server";

import { revalidatePath } from "next/cache";
import { requireAppUser } from "@/lib/auth/guard";
import { generateReturn } from "@/lib/returns/engine";
import { canTransition } from "@/lib/returns/status";
import { getDemoReturn, updateDemoReturnStatus } from "@/lib/returns/demo-store";
import { validateReturn } from "@/lib/compliance/validation";
import type { ReturnRow } from "@/lib/returns/types";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

export type GenerateReturnResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function generateReturnAction(
  code: string,
  periodKey: string
): Promise<GenerateReturnResult> {
  try {
    const user = await requireAppUser();
    const result = await generateReturn(code, periodKey, user.id);
    revalidatePath("/returns");
    return { ok: true, id: result.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate the return.",
    };
  }
}

const ALLOWED_STATUSES = [
  "DRAFT",
  "IN_PROGRESS",
  "READY_FOR_REVIEW",
  "REVIEWED",
  "APPROVED",
  "SUBMITTED",
  "CLOSED",
  "OVERDUE",
];

export type UpdateStatusResult = { ok: true } | { ok: false; error: string };

async function validateRows(code: string, rows: ReturnRow[]): Promise<{ hasErrors: boolean; errorCount: number }> {
  const result = validateReturn(code, rows);
  return { hasErrors: result.hasErrors, errorCount: result.errorCount };
}

export async function updateReturnStatusAction(
  id: string,
  status: string
): Promise<UpdateStatusResult> {
  try {
    if (!ALLOWED_STATUSES.includes(status)) {
      return { ok: false, error: `Unknown return status: ${status}` };
    }

    let current: string;
    if (!isSupabaseConfigured) {
      const record = await getDemoReturn(id);
      if (!record) return { ok: false, error: "Return not found." };
      current = record.status;
      if (!canTransition(current, status)) {
        return {
          ok: false,
          error: `Cannot move a "${current}" return to "${status}".`,
        };
      }
      if (status === "READY_FOR_REVIEW") {
        const { hasErrors, errorCount } = await validateRows(record.code, record.rows);
        if (hasErrors) {
          return {
            ok: false,
            error: `Cannot submit for review while ${errorCount} validation error${errorCount === 1 ? "" : "s"} remain. Fix them on the return detail page first.`,
          };
        }
      }
      await updateDemoReturnStatus(id, status);
    } else {
      const supabase = await createServerSupabase();
      if (!supabase) return { ok: false, error: "Supabase is not configured." };
      const { data: existing, error: readError } = await supabase
        .from("returns")
        .select("status, return_definitions(code)")
        .eq("id", id)
        .single();
      if (readError) return { ok: false, error: "Return not found." };
      current = existing.status;
      if (!canTransition(current, status)) {
        return {
          ok: false,
          error: `Cannot move a "${current}" return to "${status}".`,
        };
      }
      if (status === "READY_FOR_REVIEW") {
        const { data: lines } = await supabase
          .from("return_line_items")
          .select("row_data")
          .eq("return_id", id);
        const rows = ((lines ?? []) as { row_data: ReturnRow }[]).map((l) => l.row_data);
        const code = (existing.return_definitions as unknown as { code?: string })?.code ?? "INCOME_PRODUCTION";
        const { hasErrors, errorCount } = await validateRows(code, rows);
        if (hasErrors) {
          return {
            ok: false,
            error: `Cannot submit for review while ${errorCount} validation error${errorCount === 1 ? "" : "s"} remain. Fix them on the return detail page first.`,
          };
        }
      }
      const { error } = await supabase
        .from("returns")
        .update({ status })
        .eq("id", id);
      if (error) return { ok: false, error: error.message };
    }

    revalidatePath("/returns");
    revalidatePath(`/returns/${id}`);
    revalidatePath("/returns/calendar");
    revalidatePath("/reports/reconciliation");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update the return status.",
    };
  }
}
