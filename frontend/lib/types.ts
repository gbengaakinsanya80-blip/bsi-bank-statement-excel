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

export interface InsightsReport {
  income: Insight[];
  spending: Insight[];
  recurring: Insight[];
  anomalies: Anomaly[];
  forecast: Forecast | null;
}

export interface ParseResult {
  meta: Meta;
  transactions: Transaction[];
  validation: ValidationReport;
  summary: Summary;
  insights: InsightsReport;
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
