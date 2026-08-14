export interface Transaction {
  date: string | null;
  value_date: string | null;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  currency: string;
  branch: string;
  channel: string;
  instrument_number: string;
  transaction_type: string;
  category: string;
  page_number: number;
  line_number: number;
  is_beginning_balance: boolean;
  is_ending_balance: boolean;
  is_estimated: boolean;
  ocr_confidence: number | null;
  source_text: string;
  amount: number | null;
}

export interface ValidationIssue {
  issue_type: string;
  severity: string;
  message: string;
  page_number: number | null;
  line_number: number | null;
  expected: number | null;
  actual: number | null;
  transaction_index: number | null;
  suggested_fix: string | null;
}

export interface ValidationReport {
  missing_rows: ValidationIssue[];
  balance_errors: ValidationIssue[];
  duplicate_entries: ValidationIssue[];
  unreadable_transactions: ValidationIssue[];
  other_issues: ValidationIssue[];
  ocr_confidence: number | null;
  balance_reconciled: boolean;
  transaction_count_match: boolean;
  total_issues: number;
}

export interface MonthlyFlow {
  month: string;
  credits: number;
  debits: number;
  net: number;
}

export interface DailyFlow {
  date: string;
  credits: number;
  debits: number;
}

export interface Summary {
  opening_balance: number | null;
  closing_balance: number | null;
  total_credits: number;
  total_debits: number;
  number_of_transactions: number;
  largest_debit: number | null;
  largest_credit: number | null;
  average_debit: number | null;
  average_credit: number | null;
  total_credit_count: number;
  total_debit_count: number;
  monthly_cash_flow: MonthlyFlow[];
  daily_cash_flow: DailyFlow[];
  currency: string;
}

export interface Meta {
  file_name: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  period_start: string | null;
  period_end: string | null;
  page_count: number;
  extraction_method: string;
  ocr_used: boolean;
  total_pages_processed: number;
  parse_time_seconds: number;
  source_file_hash: string;
  bank_confidence: number;
}

export interface DetectedColumn {
  field: string;
  x0: number;
  x1: number;
}

export interface ColumnsDetected {
  source: string;
  columns: DetectedColumn[];
  header_page: number | null;
}

export interface Insight {
  kind: string;
  title: string;
  message: string;
  severity: "info" | "positive" | "warning";
  metric_value: number | null;
  detail: string | null;
}

export interface Anomaly {
  kind: string;
  severity: string;
  message: string;
  page_number: number | null;
  line_number: number | null;
  transaction_index: number | null;
  amount: number | null;
  suggested_action: string | null;
}

export interface ForecastMonth {
  month: string;
  projected_balance: number | null;
  expected_income: number;
  expected_expense: number;
  at_risk: boolean;
}

export interface Forecast {
  avg_monthly_income: number;
  avg_monthly_expense: number;
  months: ForecastMonth[];
  summary: string;
}

export interface TaxSummary {
  business_expenses: number;
  deductible_estimate: number;
  vat_estimate: number;
  business_category_breakdown: Record<string, number>;
  notes: string[];
}

export interface InsightsReport {
  income: Insight[];
  spending: Insight[];
  recurring: Insight[];
  anomalies: Anomaly[];
  forecast: Forecast | null;
  tax: TaxSummary | null;
}

export interface AccountHead {
  name: string;
  debit_total: number;
  credit_total: number;
  transaction_count: number;
  net: number;
}

export interface ParseResult {
  meta: Meta;
  transactions: Transaction[];
  validation: ValidationReport;
  summary: Summary;
  insights: InsightsReport;
  account_heads: AccountHead[];
  columns_detected: ColumnsDetected;
  raw_pages: string[];
}

export type JobStatus = "queued" | "running" | "completed" | "failed";

export interface JobSummary {
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  period_start?: string | null;
  period_end?: string | null;
  total_credits?: number;
  total_debits?: number;
  opening_balance?: number;
  closing_balance?: number;
  total_issues?: number;
  extraction_method?: string;
  transaction_count?: number;
}

export interface Job {
  job_id: string;
  filename: string;
  status: JobStatus;
  progress: number;
  message: string;
  created_at: string | null;
  finished_at: string | null;
  error: string | null;
  summary: JobSummary;
}

export type ExportFormat = "xlsx" | "csv" | "json" | "pdf" | "sqlite";

export interface SearchFilterParams {
  q?: string;
  from_date?: string;
  to_date?: string;
  min_amount?: number;
  max_amount?: number;
  balance?: number;
  tx_type?: string;
  category?: string;
  job_id?: string;
  limit?: number;
}

export interface SearchRow {
  job_id: string;
  row_index: number;
  tx_date: string | null;
  value_date: string | null;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  tx_type: string;
  category: string;
  page_number: number | null;
  line_number: number | null;
  filename: string | null;
}

export interface SearchResponse {
  count: number;
  total_credits: number;
  total_debits: number;
  filters: SearchFilterParams;
  rows: SearchRow[];
}

export interface Plan {
  code: string;
  name: string;
  price_ngn: number;
  monthly_statements: number | null;
  interval: string;
  paystack_plan: string;
}

export interface PlansResponse {
  plans: Plan[];
  paystack_public_key: string | null;
}

export interface BillingStatus {
  plan: string;
  plan_name: string;
  price_ngn: number;
  monthly_limit: number | null;
  unlimited: boolean;
  statements_used: number;
  usage_month: string | null;
  expires_at: string | null;
  active: boolean;
  customer_code: string | null;
}

// ------------------------------------------------------------------ //
// Accounting (companies, periods, financial statements)
// ------------------------------------------------------------------ //
export interface Company {
  id: string;
  name: string;
  trading_name: string | null;
  reg_number: string | null;
  country: string;
  currency: string;
  industry: string;
  accounting_basis: string;
  financial_year_end: string | null;
  opening_date: string | null;
  created_at: string | null;
}

export interface AccountingPeriod {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string | null;
}

export interface ChartAccount {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  parent_code: string | null;
  is_system: boolean;
}

export interface BankAccount {
  id: string;
  company_id: string;
  name: string;
  bank_name: string;
  account_number: string;
  currency: string;
  created_at: string | null;
}

export interface RawJob {
  id: string;
  filename: string | null;
  status: string;
  created_at: string | null;
  finished_at: string | null;
  error: string | null;
  meta_json: string | null;
}

export interface CompanyStatement {
  id: string;
  company_id: string;
  job_id: string;
  bank_account_id: string | null;
  period_id: string | null;
  linked_at: string | null;
  job_meta?: {
    filename?: string | null;
    status?: string | null;
    bank_name?: string | null;
    account_name?: string | null;
    account_number?: string | null;
    period_start?: string | null;
    period_end?: string | null;
  } | null;
  bank_account?: BankAccount | null;
  period?: AccountingPeriod | null;
}

export interface LedgerTxn {
  id: string;
  company_id: string;
  statement_id: string | null;
  row_index: number | null;
  tx_date: string | null;
  description: string | null;
  reference: string | null;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  category: string | null;
  account_code: string | null;
  transaction_type: string | null;
  confidence: number | null;
  rationale: string | null;
  status: string;
}

export interface ReportAccountLine {
  code: string;
  name: string;
  account_type: string;
  balance: number;
  change?: number;
}

export interface IncomeStatementReport {
  period_id: string | null;
  revenue: ReportAccountLine[];
  total_revenue: number;
  expenses: ReportAccountLine[];
  total_expenses: number;
  net_profit: number;
}

export interface BalanceSheetReport {
  period_id: string | null;
  assets: ReportAccountLine[];
  total_assets: number;
  liabilities: ReportAccountLine[];
  total_liabilities: number;
  equity: ReportAccountLine[];
  current_year_profit: number;
  balancing_figure: number;
  total_equity: number;
  balanced: boolean;
}

export interface CashFlowItem {
  code: string;
  name: string;
  change: number;
}

export interface CashFlowReport {
  period_id: string | null;
  operating: {
    net_profit: number;
    adjustments: CashFlowItem[];
    net_cash: number;
  };
  investing: { items: CashFlowItem[]; net_cash: number };
  financing: { items: CashFlowItem[]; net_cash: number };
  net_increase_in_cash: number;
  opening_cash: number;
  closing_cash: number;
  ties_to_cash: boolean;
}

export type ReportKind = "income-statement" | "balance-sheet" | "cash-flow";

export interface JournalLine {
  id: string;
  journal_id: string;
  account_code: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  company_id: string;
  period_id: string | null;
  journal_no: string;
  tx_date: string | null;
  reference: string | null;
  description: string;
  status: string;
  source_type: string | null;
  source_id: string | null;
  created_by: string | null;
  created_at: string | null;
  line_count?: number;
  total_debit?: number;
  total_credit?: number;
  lines?: JournalLine[];
}

export interface TrialBalanceAccount {
  code: string;
  name: string;
  account_type: string;
  normal_balance: string;
  total_debit: number;
  total_credit: number;
  balance: number;
  balance_side: string;
}

export interface TrialBalance {
  accounts: TrialBalanceAccount[];
  total_debit: number;
  total_credit: number;
  balanced: boolean;
}
