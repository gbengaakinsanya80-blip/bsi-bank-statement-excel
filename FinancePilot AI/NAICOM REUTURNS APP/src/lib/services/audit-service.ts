import type { DbClient } from "@/lib/supabase/server";
import { appendDemoAudit, listDemoAudit } from "@/lib/demo/audit-store";
import type { AuditLog } from "@/lib/types/database";

export interface AuditEntry {
  action: string;
  module: string;
  recordId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  userId?: string | null;
  ipAddress?: string | null;
  device?: string | null;
}

/** Records an application event in the audit trail (Supabase or demo JSON store). */
export async function recordAudit(
  supabase: DbClient | null,
  entry: AuditEntry,
  userId: string | null
): Promise<void> {
  const payload: AuditLog = {
    id: Date.now(),
    user_id: entry.userId ?? userId,
    action: entry.action,
    module: entry.module,
    record_id: entry.recordId ?? null,
    old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null,
    ip_address: entry.ipAddress ?? null,
    device: entry.device ?? null,
    created_at: new Date().toISOString(),
  };

  if (!supabase) {
    await appendDemoAudit(payload);
    return;
  }

  await supabase.from("audit_logs").insert({
    user_id: payload.user_id,
    action: payload.action,
    module: payload.module,
    record_id: payload.record_id,
    old_value: payload.old_value,
    new_value: payload.new_value,
    ip_address: payload.ip_address,
    device: payload.device,
  });
}

export async function listAudit(
  supabase: DbClient | null,
  limit = 100
): Promise<AuditLog[]> {
  if (!supabase) return listDemoAudit(limit);

  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as AuditLog[];
}
