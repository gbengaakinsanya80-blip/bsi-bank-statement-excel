import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/guard";
import { getImportSession } from "@/lib/import/session-store";
import { validateSheet } from "@/lib/import/validation";
import { buildXlsx } from "@/lib/returns/excel";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireAppUser();

  const session = await getImportSession(id);
  if (!session) return NextResponse.json({ error: "Import session not found." }, { status: 404 });

  const summary = validateSheet(session.rows, session.mapping);
  const rows: (string | number | null)[][] = [];
  rows.push([...session.headers, "RESULT", "ISSUES"]);
  for (const r of summary.results) {
    const result = r.duplicate ? "DUPLICATE" : r.valid ? "OK" : "INVALID";
    rows.push([...r.data, result, r.issues.join("; ")]);
  }

  const buffer = buildXlsx([{ name: "Import report", rows }]);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="import-report-${id}.xlsx"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
