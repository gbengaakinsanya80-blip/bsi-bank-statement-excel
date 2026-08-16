"use server";

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  staffSchema,
  createStaff,
  updateStaff,
  deleteStaff,
} from "@/lib/services/staff-service";
import {
  deleteDemoStaff,
  getDemoStaff,
  upsertDemoStaff,
} from "@/lib/demo/master-store";

export type StaffActionState = { error?: string; fieldErrors?: Record<string, string[]> } | null;

function nullable(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function parse(formData: FormData) {
  return staffSchema.safeParse({
    staff_name: formData.get("staff_name"),
    staff_category_id: nullable(formData.get("staff_category_id")),
    designation: nullable(formData.get("designation")),
    gender: nullable(formData.get("gender")),
    educational_qualification: nullable(formData.get("educational_qualification")),
    professional_qualification: nullable(formData.get("professional_qualification")),
    date_of_employment: nullable(formData.get("date_of_employment")),
    state_of_origin: nullable(formData.get("state_of_origin")),
    location: nullable(formData.get("location")),
    date_of_exit: nullable(formData.get("date_of_exit")),
    reason_for_leaving: nullable(formData.get("reason_for_leaving")),
  });
}

export async function createStaffAction(
  _prevState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  await requireAppUser();

  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const now = new Date().toISOString();
    await upsertDemoStaff({
      id: `demo-staff-${Date.now()}`,
      staff_name: parsed.data.staff_name,
      staff_category_id: parsed.data.staff_category_id ?? null,
      designation: parsed.data.designation ?? null,
      gender: parsed.data.gender ?? null,
      educational_qualification: parsed.data.educational_qualification ?? null,
      professional_qualification: parsed.data.professional_qualification ?? null,
      date_of_employment: parsed.data.date_of_employment ?? null,
      state_of_origin: parsed.data.state_of_origin ?? null,
      location: parsed.data.location ?? null,
      date_of_exit: parsed.data.date_of_exit ?? null,
      reason_for_leaving: parsed.data.reason_for_leaving ?? null,
      is_demo: true,
      deleted_at: null,
      created_at: now,
      updated_at: now,
    });
    redirect("/staff");
  }

  try {
    await createStaff(supabase, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save staff member." };
  }

  redirect("/staff");
}

export async function updateStaffAction(
  _prevState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing staff id." };

  const parsed = parse(formData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const existing = await getDemoStaff(id);
    await upsertDemoStaff({
      id,
      staff_name: parsed.data.staff_name,
      staff_category_id: parsed.data.staff_category_id ?? null,
      designation: parsed.data.designation ?? null,
      gender: parsed.data.gender ?? null,
      educational_qualification: parsed.data.educational_qualification ?? null,
      professional_qualification: parsed.data.professional_qualification ?? null,
      date_of_employment: parsed.data.date_of_employment ?? null,
      state_of_origin: parsed.data.state_of_origin ?? null,
      location: parsed.data.location ?? null,
      date_of_exit: parsed.data.date_of_exit ?? null,
      reason_for_leaving: parsed.data.reason_for_leaving ?? null,
      is_demo: true,
      deleted_at: null,
      created_at: existing?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    redirect("/staff");
  }

  try {
    await updateStaff(supabase, id, parsed.data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update staff member." };
  }

  redirect("/staff");
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createServerSupabase();
  if (!supabase) {
    await deleteDemoStaff(id);
    redirect("/staff");
  }

  await deleteStaff(supabase, id);
  redirect("/staff");
}
