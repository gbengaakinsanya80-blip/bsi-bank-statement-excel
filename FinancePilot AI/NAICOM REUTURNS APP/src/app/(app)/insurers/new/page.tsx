import type { Metadata } from "next";
import { InsurerForm } from "@/components/masters/insurer-form";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New insurer" };

export default async function NewInsurerPage() {
  const supabase = await createServerSupabase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New insurer</h1>
        <p className="text-sm text-muted-foreground">
          Add an underwriting company used in CRR and Form 1C.
        </p>
      </div>
      <InsurerForm demo={!supabase} />
    </div>
  );
}
