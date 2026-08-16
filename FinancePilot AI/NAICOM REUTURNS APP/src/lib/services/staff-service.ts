import { z } from "zod";
import type { Staff } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export const staffSchema = z.object({
  staff_name: z.string().trim().min(1, "Staff name is required").max(200),
  staff_category_id: z.string().trim().optional().nullable(),
  designation: z.string().trim().max(200).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE"]).optional().nullable(),
  educational_qualification: z.string().trim().max(300).optional().nullable(),
  professional_qualification: z.string().trim().max(300).optional().nullable(),
  date_of_employment: z.string().date().optional().nullable(),
  state_of_origin: z.string().trim().max(100).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  date_of_exit: z.string().date().optional().nullable(),
  reason_for_leaving: z.string().trim().max(500).optional().nullable(),
});

export type StaffInput = z.output<typeof staffSchema>;

export async function createStaff(supabase: DbClient, input: StaffInput) {
  const { data, error } = await supabase
    .from("staff")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Staff;
}

export async function updateStaff(supabase: DbClient, id: string, input: StaffInput) {
  const { data, error } = await supabase
    .from("staff")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Staff;
}

export async function deleteStaff(supabase: DbClient, id: string) {
  const { error } = await supabase
    .from("staff")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
