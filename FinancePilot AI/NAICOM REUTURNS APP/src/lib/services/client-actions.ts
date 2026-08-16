"use server";

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  clientSchema,
  createClient,
  updateClient,
  deleteClient,
} from "@/lib/services/client-service";
import {
  deleteDemoClient,
  getDemoClient,
  upsertDemoClient,
} from "@/lib/demo/master-store";

export type ClientActionState = { error?: string; fieldErrors?: Record<string, string[]> } | null;

function parse(formData: FormData) {
  return clientSchema.safeParse({
    client_name: formData.get("client_name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    contact_person: formData.get("contact_person"),
    industry: formData.get("industry"),
    status: formData.get("status") || "ACTIVE",
  });
}

export async function createClientAction(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireAppUser();

  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const now = new Date().toISOString();
    await upsertDemoClient({
      id: `demo-client-${Date.now()}`,
      client_name: parsed.data.client_name,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      contact_person: parsed.data.contact_person ?? null,
      industry: parsed.data.industry ?? null,
      status: parsed.data.status,
      is_demo: true,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    redirect("/clients");
  }

  try {
    await createClient(supabase, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save client." };
  }

  redirect("/clients");
}

export async function updateClientAction(
  _prevState: ClientActionState,
  formData: FormData
): Promise<ClientActionState> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing client id." };

  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const existing = await getDemoClient(id);
    await upsertDemoClient({
      id,
      client_name: parsed.data.client_name,
      address: parsed.data.address ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      contact_person: parsed.data.contact_person ?? null,
      industry: parsed.data.industry ?? null,
      status: parsed.data.status,
      is_demo: true,
      deleted_at: null,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    redirect("/clients");
  }

  try {
    await updateClient(supabase, id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update client." };
  }

  redirect("/clients");
}

export async function deleteClientAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createServerSupabase();
  if (!supabase) {
    await deleteDemoClient(id);
    redirect("/clients");
  }

  await deleteClient(supabase, id);
  redirect("/clients");
}
