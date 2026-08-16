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

export const demoCurrencies: Currency[] = [
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimal_places: 2, is_base: true },
  { code: "USD", name: "US Dollar", symbol: "$", decimal_places: 2, is_base: false },
  { code: "GBP", name: "British Pound", symbol: "£", decimal_places: 2, is_base: false },
  { code: "EUR", name: "Euro", symbol: "€", decimal_places: 2, is_base: false },
];

export const demoRiskClasses: RiskClass[] = [
  { id: "rc-motor", name: "Motor", code: "MOTOR", active: true },
  { id: "rc-group-life", name: "Group Life", code: "GROUP_LIFE", active: true },
  { id: "rc-fire", name: "Fire", code: "FIRE", active: true },
  { id: "rc-marine", name: "Marine", code: "MARINE", active: true },
  { id: "rc-engineering", name: "Engineering", code: "ENGINEERING", active: true },
  { id: "rc-oil", name: "Oil and Gas", code: "OIL_GAS", active: true },
  { id: "rc-aviation", name: "Aviation", code: "AVIATION", active: true },
  { id: "rc-accident", name: "Accident", code: "ACCIDENT", active: true },
  { id: "rc-bonds", name: "Bonds", code: "BONDS", active: true },
  { id: "rc-pi", name: "Professional Indemnity", code: "PROFESSIONAL_INDEMNITY", active: true },
  { id: "rc-pl", name: "Public Liability", code: "PUBLIC_LIABILITY", active: true },
  { id: "rc-el", name: "Employers Liability", code: "EMPLOYERS_LIABILITY", active: true },
  { id: "rc-misc", name: "Miscellaneous", code: "MISCELLANEOUS", active: true },
];

export const demoStaffCategories: StaffCategory[] = [
  { id: "sc-jr", name: "JUNIOR STAFF" },
  { id: "sc-sr", name: "SENIOR STAFF" },
  { id: "sc-lm", name: "LOWER MANAGEMENT" },
  { id: "sc-sm", name: "SENIOR MANAGEMENT" },
];

export const demoClients: Client[] = [
  {
    id: "cl-zenith",
    client_name: "Zenith Bank Plc",
    address: "Plot 84, Ajose Adeogun Street, Victoria Island, Lagos",
    phone: "+234 1 278 7000",
    email: "treasury@zenithbank.com",
    contact_person: "Tunde Bakare",
    industry: "Banking",
    status: "ACTIVE",
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "cl-dangote",
    client_name: "Dangote Cement Plc",
    address: "1 Industrial Avenue, Ilasamaja, Lagos",
    phone: "+234 1 463 9000",
    email: "insurance@dangote-cement.com",
    contact_person: "Ngozi Eze",
    industry: "Manufacturing",
    status: "ACTIVE",
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "cl-lagos",
    client_name: "Lagos State Government",
    address: "The Secretariat, Alausa, Ikeja, Lagos",
    phone: "+234 1 773 4000",
    email: "insurance@lagosstate.gov.ng",
    contact_person: "Bisi Ogunleye",
    industry: "Government",
    status: "ACTIVE",
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "cl-mtn",
    client_name: "MTN Nigeria Communications Plc",
    address: "Golden Tulip Building, Adeola Odeku, Victoria Island, Lagos",
    phone: "+234 1 240 0020",
    email: "insurance@mtn.com",
    contact_person: "Kunle Akinola",
    industry: "Telecom",
    status: "ACTIVE",
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
];

export const demoInsurers: Insurer[] = [
  {
    id: "in-axa",
    insurer_name: "AXA Mansard Insurance Plc",
    naicom_code: "AXA001",
    address: "12th Floor, Churchgate Tower 2, Victoria Island, Lagos",
    contact: "Hauwa Mohammed",
    email: "corporate@axamansard.com",
    active: true,
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "in-leadway",
    insurer_name: "Leadway Assurance Company Ltd",
    naicom_code: "LDW010",
    address: "121/123 Funsho Williams Avenue, Iponri, Lagos",
    contact: "Segun Alabi",
    email: "service@leadway.com",
    active: true,
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "in-aiico",
    insurer_name: "AIICO Insurance Plc",
    naicom_code: "AIC005",
    address: "PC 16, Adeola Odeku Street, Victoria Island, Lagos",
    contact: "Folake Bello",
    email: "enquiry@aiicoplc.com",
    active: true,
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "in-cornerstone",
    insurer_name: "Cornerstone Insurance Plc",
    naicom_code: "CRN003",
    address: "31 Ajose Adeogun Street, Victoria Island, Lagos",
    contact: "Ada Nwosu",
    email: "info@cornerstone-insurance.com",
    active: true,
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
];

export const demoStaff: Staff[] = [
  {
    id: "st-1",
    staff_name: "Adaeze Okafor",
    staff_category_id: "sc-sm",
    designation: "Managing Director",
    gender: "FEMALE",
    educational_qualification: "BSc Economics",
    professional_qualification: "ACII",
    date_of_employment: "2010-01-04",
    state_of_origin: "Anambra",
    location: "Lagos",
    date_of_exit: null,
    reason_for_leaving: null,
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "st-2",
    staff_name: "Emeka Obi",
    staff_category_id: "sc-lm",
    designation: "Operations Manager",
    gender: "MALE",
    educational_qualification: "BSc Actuarial Science",
    professional_qualification: "ACIIN",
    date_of_employment: "2013-06-17",
    state_of_origin: "Imo",
    location: "Lagos",
    date_of_exit: null,
    reason_for_leaving: null,
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
  {
    id: "st-3",
    staff_name: "Funke Adeyemi",
    staff_category_id: "sc-sr",
    designation: "Finance Officer",
    gender: "FEMALE",
    educational_qualification: "BSc Accounting",
    professional_qualification: "ACCA",
    date_of_employment: "2018-03-12",
    state_of_origin: "Ogun",
    location: "Lagos",
    date_of_exit: null,
    reason_for_leaving: null,
    is_demo: true,
    deleted_at: null,
    created_at: "2026-01-04T09:00:00.000Z",
    updated_at: "2026-01-04T09:00:00.000Z",
  },
];

interface DemoPolicy extends Policy {
  clients: { client_name: string } | null;
  insurers: { insurer_name: string } | null;
}

const NOW = new Date().toISOString();
const DAY = 24 * 60 * 60 * 1000;

function policy(
  id: string,
  policy_number: string,
  transaction_type: Policy["transaction_type"],
  client_id: string,
  client_name: string,
  insurer_id: string,
  insurer_name: string,
  insured_name: string,
  risk_type: string,
  gross_premium: number,
  commission: number,
  transaction_date: string,
  cover_from: string,
  cover_to: string,
  sum_insured: number,
  daysAgo: number
): DemoPolicy {
  return {
    id,
    transaction_reference: `TRX-${policy_number}`,
    policy_number,
    endorsement_number: null,
    transaction_type,
    new_or_renewal: transaction_type === "NEW" ? "NEW" : "RENEWAL",
    risk_type,
    class_of_business: risk_type,
    client_id,
    insured_name,
    insurer_id,
    broker_or_agent: null,
    ledger_account: null,
    sum_insured: sum_insured.toFixed(2),
    currency: "NGN",
    gross_premium: gross_premium.toFixed(2),
    premium_collected: gross_premium.toFixed(2),
    premium_paid_to_insurer: (gross_premium - commission).toFixed(2),
    brokerage_commission: commission.toFixed(2),
    commission_rate: "12.50",
    tax: "0.00",
    other_deductions: "0.00",
    net_premium: gross_premium.toFixed(2),
    amount_received: gross_premium.toFixed(2),
    receipt_number: `RCV-${policy_number.slice(-4)}`,
    debit_note_number: null,
    credit_note_number: null,
    transaction_date,
    cover_from,
    cover_to,
    premium_collection_date: transaction_date,
    premium_payment_date: transaction_date,
    branch_location: "Lagos",
    remarks: null,
    status: "ACTIVE",
    is_demo: true,
    created_by: null,
    deleted_at: null,
    created_at: new Date(Date.now() - daysAgo * DAY).toISOString(),
    updated_at: NOW,
    clients: { client_name },
    insurers: { insurer_name },
  };
}

export const demoPolicies: DemoPolicy[] = [
  policy("pol-1", "WMK/2026/0001", "NEW", "cl-zenith", "Zenith Bank Plc", "in-axa", "AXA Mansard Insurance Plc", "Zenith Bank Plc", "Fire", 25_000_000, 3_125_000, "2026-01-05", "2026-01-01", "2026-12-31", 5_000_000_000, 30),
  policy("pol-2", "WMK/2026/0002", "RENEWAL", "cl-dangote", "Dangote Cement Plc", "in-leadway", "Leadway Assurance Company Ltd", "Dangote Cement Plc", "Motor", 18_000_000, 2_250_000, "2026-01-12", "2026-02-01", "2027-01-31", 1_200_000_000, 27),
  policy("pol-3", "WMK/2026/0003", "NEW", "cl-mtn", "MTN Nigeria Communications Plc", "in-aiico", "AIICO Insurance Plc", "MTN Nigeria Communications Plc", "Group Life", 32_000_000, 4_000_000, "2026-02-03", "2026-02-01", "2027-01-31", 8_000_000_000, 24),
  policy("pol-4", "WMK/2026/0004", "NEW", "cl-zenith", "Zenith Bank Plc", "in-cornerstone", "Cornerstone Insurance Plc", "Zenith Bank Plc", "Marine", 6_500_000, 812_500, "2026-02-17", "2026-02-10", "2026-03-10", 850_000_000, 21),
  policy("pol-5", "WMK/2026/0005", "NEW", "cl-lagos", "Lagos State Government", "in-leadway", "Leadway Assurance Company Ltd", "Lagos State Government", "Engineering", 9_200_000, 1_150_000, "2026-03-02", "2026-03-01", "2027-02-28", 2_400_000_000, 18),
  policy("pol-6", "WMK/2026/0006", "RENEWAL", "cl-dangote", "Dangote Cement Plc", "in-axa", "AXA Mansard Insurance Plc", "Dangote Cement Plc", "Public Liability", 4_100_000, 512_500, "2026-03-11", "2026-04-01", "2027-03-31", 900_000_000, 15),
  policy("pol-7", "WMK/2026/0007", "NEW", "cl-zenith", "Zenith Bank Plc", "in-aiico", "AIICO Insurance Plc", "Zenith Bank Plc", "Bonds", 2_800_000, 350_000, "2026-04-06", "2026-04-01", "2027-03-31", 600_000_000, 12),
  policy("pol-8", "WMK/2026/0008", "NEW", "cl-mtn", "MTN Nigeria Communications Plc", "in-cornerstone", "Cornerstone Insurance Plc", "MTN Nigeria Communications Plc", "Fire", 7_600_000, 950_000, "2026-05-12", "2026-05-01", "2027-04-30", 1_500_000_000, 8),
];

export const demoRecentPolicies: RecentPolicy[] = demoPolicies.map((p) => ({
  id: p.id,
  policy_number: p.policy_number,
  transaction_type: p.transaction_type,
  insured_name: p.insured_name,
  client_name: p.clients!.client_name,
  insurer_name: p.insurers!.insurer_name,
  risk_type: p.risk_type,
  currency: p.currency,
  gross_premium: p.gross_premium,
  premium_collected: p.premium_collected,
  brokerage_commission: p.brokerage_commission,
  transaction_date: p.transaction_date,
  created_at: p.created_at,
}));

export const demoKpis: DashboardKpis = {
  policies_count: demoPolicies.length,
  active_policies_count: demoPolicies.length,
  gross_premium_total: demoPolicies.reduce((s, p) => s + Number(p.gross_premium), 0),
  premium_collected_total: demoPolicies.reduce((s, p) => s + Number(p.premium_collected), 0),
  commission_total: demoPolicies.reduce((s, p) => s + Number(p.brokerage_commission), 0),
  net_premium_total: demoPolicies.reduce((s, p) => s + Number(p.net_premium), 0),
  clients_count: demoClients.length,
  insurers_count: demoInsurers.length,
  staff_count: demoStaff.length,
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
    staff_categories:
      demoStaffCategories.find((c) => c.id === s.staff_category_id) ?? null,
  }));
}
