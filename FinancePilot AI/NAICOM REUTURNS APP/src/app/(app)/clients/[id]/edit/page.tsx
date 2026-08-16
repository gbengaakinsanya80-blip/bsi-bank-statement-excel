import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ClientForm } from "@/components/masters/client-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { listClients } from "@/lib/services/client-service";
import { getDemoClient } from "@/lib/demo/master-store";

export const metadata: Metadata = { title: "Edit client" };

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const client = supabase
    ? ((await listClients(supabase)).find((c) => c.id === id) ?? null)
    : await getDemoClient(id);
  if (!client) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit client</h1>
        <p className="text-sm text-muted-foreground">Update the client master record.</p>
      </div>
      <ClientForm client={client} demo={!supabase} />
    </div>
  );
}
