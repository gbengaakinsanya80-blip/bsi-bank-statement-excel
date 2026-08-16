import type { Currency, RiskClass, Staff, StaffCategory } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export async function listRiskClasses(supabase: DbClient) {
  const { data, error } = await supabase
    .from("risk_classes")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw new Error(error.message);
  return data as RiskClass[];
}

export async function listCurrencies(supabase: DbClient) {
  const { data, error } = await supabase
    .from("currencies")
    .select("*")
    .order("is_base", { ascending: false })
    .order("code");
  if (error) throw new Error(error.message);
  return data as Currency[];
}

export async function listStaff(supabase: DbClient) {
  const { data, error } = await supabase
    .from("staff")
    .select(`*, staff_categories(name)`)
    .is("deleted_at", null)
    .eq("is_demo", false)
    .order("staff_name");
  if (error) throw new Error(error.message);
  return data as (Staff & { staff_categories: { name: string } | null })[];
}

export async function listStaffCategories(supabase: DbClient) {
  const { data, error } = await supabase
    .from("staff_categories")
    .select("*")
    .order("name");
  if (error) throw new Error(error.message);
  return data as StaffCategory[];
}
