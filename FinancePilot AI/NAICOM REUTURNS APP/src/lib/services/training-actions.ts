"use server";

import { redirect } from "next/navigation";
import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  upsertDemoTrainingRecord,
  getDemoTrainingRecord,
  deleteDemoTrainingRecord,
} from "@/lib/demo/training-store";
import type { TrainingRecord, TrainingType, TrainingStatus } from "@/lib/types/database";

export type TrainingActionState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
} | null;

function nullable(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function nullableNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseFormData(formData: FormData) {
  const errors: Record<string, string[]> = {};
  const staffName = nullable(formData.get("staff_name"));
  const trainingTitle = nullable(formData.get("training_title"));
  const trainingDate = nullable(formData.get("training_date"));
  const organizer = nullable(formData.get("organizer"));

  if (!staffName) errors.staff_name = ["Staff name is required."];
  if (!trainingTitle) errors.training_title = ["Training title is required."];
  if (!trainingDate) errors.training_date = ["Training date is required."];
  if (!organizer) errors.organizer = ["Organizer is required."];

  if (Object.keys(errors).length > 0) {
    return { ok: false as const, errors };
  }

  const data: Omit<TrainingRecord, "id" | "is_demo" | "deleted_at" | "created_at" | "updated_at"> = {
    staff_name: staffName!,
    position: nullable(formData.get("position")),
    training_title: trainingTitle!,
    training_type: nullable(formData.get("training_type")) as TrainingType | null,
    organizer: organizer!,
    training_date: trainingDate!,
    training_end_date: nullable(formData.get("training_end_date")),
    duration_hours: nullableNum(formData.get("duration_hours")),
    training_location: nullable(formData.get("training_location")),
    what_was_learned: nullable(formData.get("what_was_learned")),
    certificate_available: formData.get("certificate_available") === "on",
    certificate_file_name: nullable(formData.get("existing_cert_name")),
    certificate_file_data: nullable(formData.get("existing_cert_data")),
    training_cost: nullableNum(formData.get("training_cost")),
    status: (nullable(formData.get("status")) as TrainingStatus) ?? "COMPLETED",
    remarks: nullable(formData.get("remarks")),
  };

  return { ok: true as const, data };
}

function toRecord(
  data: Omit<TrainingRecord, "id" | "is_demo" | "deleted_at" | "created_at" | "updated_at">,
  existing?: TrainingRecord | null
): TrainingRecord {
  const now = new Date().toISOString();
  return {
    ...data,
    id: existing?.id ?? `demo-training-${Date.now()}`,
    is_demo: true,
    deleted_at: null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}

export async function createTrainingAction(
  _prevState: TrainingActionState,
  formData: FormData
): Promise<TrainingActionState> {
  await requireAppUser();

  const parsed = parseFormData(formData);
  if (!parsed.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const record = toRecord(parsed.data);
    await upsertDemoTrainingRecord(record);
    redirect("/training");
  }

  try {
    const { error } = await supabase.from("training_records").insert({
      staff_name: parsed.data.staff_name,
      position: parsed.data.position,
      training_title: parsed.data.training_title,
      training_type: parsed.data.training_type,
      organizer: parsed.data.organizer,
      training_date: parsed.data.training_date,
      training_end_date: parsed.data.training_end_date,
      duration_hours: parsed.data.duration_hours,
      training_location: parsed.data.training_location,
      what_was_learned: parsed.data.what_was_learned,
      certificate_available: parsed.data.certificate_available,
      certificate_file_name: parsed.data.certificate_file_name,
      certificate_file_data: parsed.data.certificate_file_data,
      training_cost: parsed.data.training_cost,
      status: parsed.data.status,
      remarks: parsed.data.remarks,
      is_demo: false,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save training record." };
  }

  redirect("/training");
}

export async function updateTrainingAction(
  _prevState: TrainingActionState,
  formData: FormData
): Promise<TrainingActionState> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing training record id." };

  const parsed = parseFormData(formData);
  if (!parsed.ok) {
    return { error: "Please fix the highlighted fields.", fieldErrors: parsed.errors };
  }

  const supabase = await createServerSupabase();
  if (!supabase) {
    const existing = await getDemoTrainingRecord(id);
    const record = toRecord(parsed.data, existing);
    await upsertDemoTrainingRecord(record);
    redirect("/training");
  }

  try {
    const { error } = await supabase
      .from("training_records")
      .update({
        staff_name: parsed.data.staff_name,
        position: parsed.data.position,
        training_title: parsed.data.training_title,
        training_type: parsed.data.training_type,
        organizer: parsed.data.organizer,
        training_date: parsed.data.training_date,
        training_end_date: parsed.data.training_end_date,
        duration_hours: parsed.data.duration_hours,
        training_location: parsed.data.training_location,
        what_was_learned: parsed.data.what_was_learned,
        certificate_available: parsed.data.certificate_available,
        certificate_file_name: parsed.data.certificate_file_name,
        certificate_file_data: parsed.data.certificate_file_data,
        training_cost: parsed.data.training_cost,
        status: parsed.data.status,
        remarks: parsed.data.remarks,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not update training record." };
  }

  redirect("/training");
}

export async function deleteTrainingAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createServerSupabase();
  if (!supabase) {
    await deleteDemoTrainingRecord(id);
    redirect("/training");
  }

  const { error } = await supabase
    .from("training_records")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  redirect("/training");
}
