import type { Metadata } from "next";
import { ClientForm } from "@/components/masters/client-form";
import { createServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New client" };

export default async function NewClientPage() {
  const supabase = await createServerSupabase();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New client</h1>
        <p className="text-sm text-muted-foreground">
          Add a customer record used across policies and returns.
        </p>
      </div>
      <ClientForm demo={!supabase} />
    </div>
  );
}
