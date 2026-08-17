import type { Metadata } from "next";
import { TrainingForm } from "@/components/training/training-form";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New Training Record" };

export default async function NewTrainingPage() {
  const supabase = await createServerSupabase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Training Record</h1>
        <p className="text-sm text-muted-foreground">
          Record a staff training programme, certification, or professional development activity.
        </p>
      </div>
      <TrainingForm demo={!supabase} />
    </div>
  );
}
