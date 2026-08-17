import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { listDemoTrainingRecords } from "@/lib/demo/training-store";
import { generateTrainingRecordsPdf } from "@/lib/training/pdf";
import type { TrainingRecord } from "@/lib/types/database";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let records: TrainingRecord[];

  const supabase = await createServerSupabase();
  if (supabase) {
    let query = supabase
      .from("training_records")
      .select("*")
      .is("deleted_at", null)
      .order("training_date", { ascending: false });
    if (from) query = query.gte("training_date", from);
    if (to) query = query.lte("training_date", to);
    const { data } = await query;
    records = data ?? [];
  } else {
    records = await listDemoTrainingRecords();
    if (from) records = records.filter((r) => r.training_date >= from);
    if (to) records = records.filter((r) => r.training_date <= to);
  }

  const dateRange = from || to
    ? `Period: ${from ?? "—"} to ${to ?? "—"}`
    : `All records — generated ${new Date().toLocaleDateString("en-GB")}`;

  const bytes = await generateTrainingRecordsPdf(records, {
    title: "STAFF TRAINING RECORDS",
    dateRange,
  });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="training-records-${new Date().toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
