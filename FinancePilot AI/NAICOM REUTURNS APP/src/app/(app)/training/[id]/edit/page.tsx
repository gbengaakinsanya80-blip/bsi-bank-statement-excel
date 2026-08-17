import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrainingForm } from "@/components/training/training-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDemoTrainingRecord } from "@/lib/demo/training-store";

export const metadata: Metadata = { title: "Edit Training Record" };

async function getRecord(id: string) {
  const supabase = await createServerSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("training_records")
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    return data;
  }
  return getDemoTrainingRecord(id);
}

export default async function EditTrainingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const record = await getRecord(id);
  if (!record) notFound();

  const supabase = await createServerSupabase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit Training Record</h1>
        <p className="text-sm text-muted-foreground">
          Update the details for &ldquo;{record.training_title}&rdquo;.
        </p>
      </div>
      <TrainingForm record={record} demo={!supabase} />
    </div>
  );
}
