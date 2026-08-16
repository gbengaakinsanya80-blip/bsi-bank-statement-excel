import { z } from "zod";
import type { Client } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export const clientSchema = z.object({
  client_name: z.string().trim().min(1, "Client name is required").max(200),
  address: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).transform((v) => (v ? v : null)),
  contact_person: z.string().trim().max(200).optional().nullable(),
  industry: z.string().trim().max(200).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
});

export type ClientInput = z.output<typeof clientSchema>;

export async function listClients(supabase: DbClient) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .is("deleted_at", null)
    .eq("is_demo", false)
    .order("client_name");
  if (error) throw new Error(error.message);
  return data as Client[];
}

export async function createClient(supabase: DbClient, input: ClientInput) {
  const { data, error } = await supabase
    .from("clients")
    .insert(input)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Client;
}
