import type { DashboardKpis, RecentPolicy } from "@/lib/types/database";
import type { DbClient } from "@/lib/supabase/server";

export async function getDashboardKpis(supabase: DbClient): Promise<DashboardKpis> {
  try {
    const { data, error } = await supabase
      .from("v_dashboard_kpis")
      .select("*")
      .single();
    if (error) throw error;
    return data as DashboardKpis;
  } catch {
    return {
      policies_count: 0,
      active_policies_count: 0,
      gross_premium_total: 0,
      premium_collected_total: 0,
      commission_total: 0,
      net_premium_total: 0,
      clients_count: 0,
      insurers_count: 0,
      staff_count: 0,
      policies_this_month: 0,
    };
  }
}

export async function getRecentPolicies(supabase: DbClient, limit = 8): Promise<RecentPolicy[]> {
  try {
    const { data, error } = await supabase
      .from("v_recent_policies")
      .select("*")
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RecentPolicy[];
  } catch {
    return [];
  }
}
