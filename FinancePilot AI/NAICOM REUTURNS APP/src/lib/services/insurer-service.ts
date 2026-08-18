import { z } from "zod";
import type { Insurer } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export const insurerSchema = z.object({
  insurer_name: z.string().trim().min(1, "Insurer name is required").max(200),
  naicom_code: z.string().trim().max(100).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  contact: z.string().trim().max(200).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  active: z.boolean().default(true),
});

export type InsurerInput = z.output<typeof insurerSchema>;

export async function listInsurers(supabase: DbClient): Promise<Insurer[]> {
  try {
    const { data, error } = await supabase
      .from("insurers")
      .select("*")
      .is("deleted_at", null)
      .eq("is_demo", false)
      .eq("active", true)
      .order("insurer_name");
    if (error) throw error;
    return (data ?? []) as Insurer[];
  } catch {
    return [];
  }
}

export async function createInsurer(supabase: DbClient, input: InsurerInput) {
  const { data, error } = await supabase
    .from("insurers")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Insurer;
}

export async function updateInsurer(supabase: DbClient, id: string, input: InsurerInput) {
  const { data, error } = await supabase
    .from("insurers")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Insurer;
}

export async function deleteInsurer(supabase: DbClient, id: string) {
  const { error } = await supabase
    .from("insurers")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
