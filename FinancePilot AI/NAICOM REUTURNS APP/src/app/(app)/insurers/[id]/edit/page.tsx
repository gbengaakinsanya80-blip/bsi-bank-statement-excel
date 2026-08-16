import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InsurerForm } from "@/components/masters/insurer-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { listInsurers } from "@/lib/services/insurer-service";
import { getDemoInsurer } from "@/lib/demo/master-store";

export const metadata: Metadata = { title: "Edit insurer" };

export default async function EditInsurerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const insurer = supabase
    ? ((await listInsurers(supabase)).find((i) => i.id === id) ?? null)
    : await getDemoInsurer(id);
  if (!insurer) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit insurer</h1>
        <p className="text-sm text-muted-foreground">Update the insurer master record.</p>
      </div>
      <InsurerForm insurer={insurer} demo={!supabase} />
    </div>
  );
}
