import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { requireAppUser } from "@/lib/auth/guard";
import { getReturnInstance } from "@/lib/returns/return-service";
import { getDemoReturnView } from "@/lib/returns/demo-store";
import { buildReturnWorkbook } from "@/lib/returns/excel";
import { RETURN_COLUMNS, type ReturnColumn } from "@/lib/returns/columns";
import type { ReturnInstanceView } from "@/lib/returns/types";

export const dynamic = "force-dynamic";

interface TemplateColumnsShape {
  return_definitions: {
    return_templates: {
      columns: unknown[];
    } | null;
  } | null;
}

function isTemplateColumn(c: unknown): c is Record<string, unknown> {
  return (
    typeof c === "object" &&
    c !== null &&
    typeof (c as Record<string, unknown>).key === "string"
  );
}

async function resolveTemplateColumns(
  supabase: Awaited<ReturnType<typeof createServerSupabase>> & object,
  id: string
): Promise<ReturnColumn[] | undefined> {
  const { data } = await supabase
    .from("returns")
    .select("return_definitions(return_templates(columns))")
    .eq("id", id)
    .single();
  const template = (data as TemplateColumnsShape | null)?.return_definitions?.return_templates;
  if (!template) return undefined;
  const raw = template.columns ?? [];
  const mapped = raw
    .filter(isTemplateColumn)
    .map((c) => ({
      key: c.key as string,
      header: typeof c.header === "string" ? (c.header as string) : (c.key as string),
      type: (["text", "money", "number", "date", "percent"] as const).includes(
        c.type as ReturnColumn["type"]
      )
        ? (c.type as ReturnColumn["type"])
        : "text",
      currency: typeof c.currency === "string" ? (c.currency as string) : undefined,
    }));
  return mapped.length > 0 ? mapped : undefined;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireAppUser();

  const supabase = await createServerSupabase();
  const demo = !supabase;

  const instance: ReturnInstanceView | null = demo
    ? await getDemoReturnView(id)
    : await getReturnInstance(supabase!, id);
  if (!instance) {
    return NextResponse.json({ error: "Return not found." }, { status: 404 });
  }

  const templateColumns = demo ? undefined : await resolveTemplateColumns(supabase!, id);
  const columns = templateColumns ?? RETURN_COLUMNS[instance.code];

  const result = buildReturnWorkbook({
    code: instance.code,
    rows: instance.rows,
    totals: instance.totals,
    periodLabel: instance.periodLabel,
    formNumber: instance.formNumber,
    columns,
  });

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Content-Length": String(result.buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
