import type {
  Client,
  Currency,
  DashboardKpis,
  Insurer,
  Policy,
  RecentPolicy,
  RiskClass,
  Staff,
  StaffCategory,
} from "@/lib/types/database";

export const DEMO_SESSION_COOKIE = "demo_session";

export const demoUser = {
  id: "00000000-0000-0000-0000-000000000000",
  name: "Preview User",
  email: "preview@worldmark.local",
  phone: null,
  role: "SUPER_ADMIN",
  department: "Management",
  active: true,
  last_login: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
} as const;

export const demoCurrencies: Currency[] = [];

export const demoRiskClasses: RiskClass[] = [];

export const demoStaffCategories: StaffCategory[] = [];

export const demoClients: Client[] = [];

export const demoInsurers: Insurer[] = [];

export const demoStaff: Staff[] = [];

interface DemoPolicy extends Policy {
  clients: { client_name: string } | null;
  insurers: { insurer_name: string } | null;
}

export const demoPolicies: DemoPolicy[] = [];

export const demoRecentPolicies: RecentPolicy[] = [];

export const demoKpis: DashboardKpis = {
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

export async function demoPoliciesForTable() {
  const { listStoredDemoPolicies } = await import("@/lib/demo/policy-store");
  const stored = await listStoredDemoPolicies();
  return [...demoPolicies, ...stored];
}

export function demoStaffForTable() {
  return demoStaff.map((s) => ({
    ...s,
    staff_categories: null,
  }));
}
