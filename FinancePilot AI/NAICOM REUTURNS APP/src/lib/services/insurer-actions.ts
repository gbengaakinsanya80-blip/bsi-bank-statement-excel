"use server";

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  insurerSchema,
  createInsurer,
  updateInsurer,
  deleteInsurer,
} from "@/lib/services/insurer-service";
import {
  deleteDemoInsurer,
  getDemoInsurer,
  upsertDemoInsurer,
} from "@/lib/demo/master-store";

export type InsurerActionState = { error?: string; fieldErrors?: Record<string, string[]> } | null;

function parse(formData: FormData) {
  return insurerSchema.safeParse({
    insurer_name: formData.get("insurer_name"),
    naicom_code: formData.get("naicom_code"),
    address: formData.get("address"),
    contact: formData.get("contact"),
    email: formData.get("email"),
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
}

export async function createInsurerAction(
  _prevState: InsurerActionState,
  formData: FormData
): Promise<InsurerActionState> {
  await requireAppUser();

  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const now = new Date().toISOString();
    await upsertDemoInsurer({
      id: `demo-insurer-${Date.now()}`,
      insurer_name: parsed.data.insurer_name,
      naicom_code: parsed.data.naicom_code ?? null,
      address: parsed.data.address ?? null,
      contact: parsed.data.contact ?? null,
      email: parsed.data.email ?? null,
      active: parsed.data.active,
      is_demo: true,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    redirect("/insurers");
  }

  try {
    await createInsurer(supabase, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save insurer." };
  }

  redirect("/insurers");
}

export async function updateInsurerAction(
  _prevState: InsurerActionState,
  formData: FormData
): Promise<InsurerActionState> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing insurer id." };

  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const existing = await getDemoInsurer(id);
    await upsertDemoInsurer({
      id,
      insurer_name: parsed.data.insurer_name,
      naicom_code: parsed.data.naicom_code ?? null,
      address: parsed.data.address ?? null,
      contact: parsed.data.contact ?? null,
      email: parsed.data.email ?? null,
      active: parsed.data.active,
      is_demo: true,
      deleted_at: null,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    redirect("/insurers");
  }

  try {
    await updateInsurer(supabase, id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update insurer." };
  }

  redirect("/insurers");
}

export async function deleteInsurerAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createServerSupabase();
  if (!supabase) {
    await deleteDemoInsurer(id);
    redirect("/insurers");
  }

  await deleteInsurer(supabase, id);
  redirect("/insurers");
}
