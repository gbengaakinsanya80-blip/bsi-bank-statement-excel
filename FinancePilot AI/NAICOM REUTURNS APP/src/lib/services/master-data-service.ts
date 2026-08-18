import type { Currency, RiskClass, Staff, StaffCategory } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export async function listRiskClasses(supabase: DbClient): Promise<RiskClass[]> {
  try {
    const { data, error } = await supabase
      .from("risk_classes")
      .select("*")
      .eq("active", true)
      .order("name");
    if (error) throw error;
    return (data ?? []) as RiskClass[];
  } catch {
    return [];
  }
}

export async function listCurrencies(supabase: DbClient): Promise<Currency[]> {
  try {
    const { data, error } = await supabase
      .from("currencies")
      .select("*")
      .order("is_base", { ascending: false })
      .order("code");
    if (error) throw error;
    return (data ?? []) as Currency[];
  } catch {
    return [];
  }
}

export async function listStaff(supabase: DbClient): Promise<(Staff & { staff_categories: { name: string } | null })[]> {
  try {
    const { data, error } = await supabase
      .from("staff")
      .select(`*, staff_categories(name)`)
      .is("deleted_at", null)
      .eq("is_demo", false)
      .order("staff_name");
    if (error) throw error;
    return (data ?? []) as (Staff & { staff_categories: { name: string } | null })[];
  } catch {
    return [];
  }
}

export async function listStaffCategories(supabase: DbClient): Promise<StaffCategory[]> {
  try {
    const { data, error } = await supabase
      .from("staff_categories")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data ?? []) as StaffCategory[];
  } catch {
    return [];
  }
}
