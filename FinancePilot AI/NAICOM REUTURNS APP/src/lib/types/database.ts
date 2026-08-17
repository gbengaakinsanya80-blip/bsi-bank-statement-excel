export type Role =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "FINANCE"
  | "OPERATIONS"
  | "HR"
  | "REVIEWER"
  | "VIEWER";

export interface Company {
  id: string;
  company_name: string;
  registration_number: string | null;
  naicom_number: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  reporting_contact: string | null;
  logo_url: string | null;
  default_currency: string;
  financial_year_start_month: number;
}

export interface AppUser {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: Role;
  department: string | null;
  active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface Client {
  id: string;
  client_name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  contact_person: string | null;
  industry: string | null;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  is_demo: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Insurer {
  id: string;
  insurer_name: string;
  naicom_code: string | null;
  address: string | null;
  contact: string | null;
  email: string | null;
  active: boolean;
  is_demo: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskClass {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
}

export interface StaffCategory {
  id: string;
  name: string;
}

export interface Staff {
  id: string;
  staff_name: string;
  staff_category_id: string | null;
  designation: string | null;
  gender: "MALE" | "FEMALE" | null;
  educational_qualification: string | null;
  professional_qualification: string | null;
  date_of_employment: string | null;
  state_of_origin: string | null;
  location: string | null;
  date_of_exit: string | null;
  reason_for_leaving: string | null;
  is_demo: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TransactionType =
  | "NEW"
  | "RENEWAL"
  | "ENDORSEMENT"
  | "DEBIT_NOTE"
  | "CREDIT_NOTE"
  | "CANCELLATION";

export interface Policy {
  id: string;
  transaction_reference: string | null;
  policy_number: string | null;
  endorsement_number: string | null;
  transaction_type: TransactionType;
  new_or_renewal: "NEW" | "RENEWAL" | null;
  risk_type: string | null;
  class_of_business: string | null;
  client_id: string | null;
  insured_name: string | null;
  insurer_id: string | null;
  broker_or_agent: string | null;
  ledger_account: string | null;
  sum_insured: string | null;
  currency: string;
  gross_premium: string | null;
  premium_collected: string | null;
  premium_paid_to_insurer: string | null;
  brokerage_commission: string | null;
  commission_rate: string | null;
  tax: string | null;
  other_deductions: string | null;
  net_premium: string | null;
  amount_received: string | null;
  receipt_number: string | null;
  debit_note_number: string | null;
  credit_note_number: string | null;
  transaction_date: string | null;
  cover_from: string | null;
  cover_to: string | null;
  premium_collection_date: string | null;
  premium_payment_date: string | null;
  branch_location: string | null;
  remarks: string | null;
  status: "ACTIVE" | "ARCHIVED";
  is_demo: boolean;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Currency {
  code: string;
  name: string | null;
  symbol: string | null;
  decimal_places: number;
  is_base: boolean;
}

export interface DashboardKpis {
  policies_count: number;
  active_policies_count: number;
  gross_premium_total: number;
  premium_collected_total: number;
  commission_total: number;
  net_premium_total: number;
  clients_count: number;
  insurers_count: number;
  staff_count: number;
  policies_this_month: number;
}

export interface RecentPolicy {
  id: string;
  policy_number: string | null;
  transaction_type: TransactionType;
  insured_name: string | null;
  client_name: string | null;
  insurer_name: string | null;
  risk_type: string | null;
  currency: string;
  gross_premium: string | null;
  premium_collected: string | null;
  brokerage_commission: string | null;
  transaction_date: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id: string | null;
  action: string;
  module: string;
  record_id: string | null;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  device: string | null;
  created_at: string;
}

export type TrainingType =
  | "TECHNICAL"
  | "COMPLIANCE"
  | "MANAGEMENT"
  | "SAFETY"
  | "SOFT_SKILLS"
  | "OTHER";

export type TrainingStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";

export interface TrainingRecord {
  id: string;
  staff_name: string;
  position: string | null;
  training_title: string;
  training_type: TrainingType | null;
  organizer: string;
  training_date: string;
  training_end_date: string | null;
  duration_hours: number | null;
  training_location: string | null;
  what_was_learned: string | null;
  certificate_available: boolean;
  certificate_file_name: string | null;
  certificate_file_data: string | null;
  training_cost: number | null;
  status: TrainingStatus;
  remarks: string | null;
  is_demo: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
