import type { DashboardKpis, RecentPolicy } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export async function getDashboardKpis(supabase: DbClient) {
  const { data, error } = await supabase
    .from("v_dashboard_kpis")
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as DashboardKpis;
}

export async function getRecentPolicies(supabase: DbClient, limit = 8) {
  const { data, error } = await supabase
    .from("v_recent_policies")
    .select("*")
    .limit(limit);
  if (error) throw new Error(error.message);
  return data as RecentPolicy[];
}
