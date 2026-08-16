import type { DbClient } from "@/lib/supabase/server";
import { computeReturnTotals } from "@/lib/returns/columns";
import { validateReturn } from "@/lib/compliance/validation";
import type {
  ReturnInstanceSummary,
  ReturnInstanceView,
  ReturnRow,
} from "@/lib/returns/types";

interface DbReturnRow {
  id: string;
  definition_id: string;
  period_label: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  return_definitions: {
    name: string;
    code: string;
    form_number: string | null;
    frequency: string;
    responsible_department: string | null;
  };
}

function summaryFromRow(r: DbReturnRow, rowCount: number, versionNo: number): ReturnInstanceSummary {
  const def = r.return_definitions;
  return {
    id: r.id,
    code: def.code,
    name: def.name,
    formNumber: def.form_number,
    frequency: def.frequency as ReturnInstanceSummary["frequency"],
    department: def.responsible_department ?? "—",
    periodLabel: r.period_label,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    status: r.status,
    createdAt: r.created_at,
    rowCount,
    versionNo,
    qualityScore: null,
  };
}

export async function listReturnInstances(supabase: DbClient): Promise<ReturnInstanceSummary[]> {
  const { data, error } = await supabase
    .from("returns")
    .select(
      `id,
       definition_id,
       period_label,
       period_start,
       period_end,
       status,
       created_at,
       return_definitions(name, code, form_number, frequency, responsible_department)`
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as DbReturnRow[];

  const ids = rows.map((r) => r.id);
  const counts = new Map<string, number>();
  const maxVersions = new Map<string, number>();
  if (ids.length > 0) {
    const { data: lines } = await supabase
      .from("return_line_items")
      .select("return_id")
      .in("return_id", ids);
    for (const line of lines ?? []) {
      counts.set(line.return_id, (counts.get(line.return_id) ?? 0) + 1);
    }

    const { data: versions } = await supabase
      .from("return_versions")
      .select("return_id, version_no")
      .in("return_id", ids);
    for (const v of versions ?? []) {
      const current = maxVersions.get(v.return_id) ?? 0;
      if (v.version_no > current) maxVersions.set(v.return_id, v.version_no);
    }
  }

  return rows.map((r) => summaryFromRow(r, counts.get(r.id) ?? 0, maxVersions.get(r.id) ?? 1));
}

export async function getReturnInstance(
  supabase: DbClient,
  id: string
): Promise<ReturnInstanceView | null> {
  const { data, error } = await supabase
    .from("returns")
    .select(
      `id,
       definition_id,
       period_label,
       period_start,
       period_end,
       status,
       created_at,
       return_definitions(name, code, form_number, frequency, responsible_department)`
    )
    .eq("id", id)
    .single();
  if (error) return null;
  const row = data as unknown as DbReturnRow;

  const { data: lines } = await supabase
    .from("return_line_items")
    .select("row_data")
    .eq("return_id", id)
    .order("created_at", { ascending: true });
  const rows = ((lines ?? []) as { row_data: ReturnRow }[]).map((l) => l.row_data);

  const { data: versionRow } = await supabase
    .from("return_versions")
    .select("version_no")
    .eq("return_id", id)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  const def = row.return_definitions;
  return {
    id: row.id,
    code: def.code,
    name: def.name,
    formNumber: def.form_number,
    frequency: def.frequency as ReturnInstanceView["frequency"],
    department: def.responsible_department ?? "—",
    periodKey: `${row.period_start}_to_${row.period_end}`,
    periodLabel: row.period_label,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    status: row.status,
    createdAt: row.created_at,
    rowCount: rows.length,
    versionNo: versionRow?.version_no ?? 1,
    rows,
    totals: computeReturnTotals(def.code, rows),
    quality: validateReturn(def.code, rows),
  };
}
