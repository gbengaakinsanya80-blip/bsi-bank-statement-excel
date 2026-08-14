import { getToken } from "./auth";
import type { AuthUser } from "./auth";
import type {
  AccountingPeriod, BalanceSheetReport, BankAccount, BillingStatus, CashFlowReport,
  ChartAccount, Company, CompanyStatement, ExportFormat, IncomeStatementReport, Job,
  JournalEntry, LedgerTxn, ParseResult, PlansResponse, RawJob, ReportKind,
  SearchFilterParams, SearchResponse, Transaction, TrialBalance,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export async function register(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Registration failed.");
  }
  return body as { token: string; user: AuthUser };
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Login failed.");
  }
  return body as { token: string; user: AuthUser };
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Session expired.");
  }
  return body as AuthUser;
}

export async function uploadPdf(file: File): Promise<string> {
  const form = new FormData();
  form.append("upload", file);
  const res = await fetch(`${API_BASE}/process`, { method: "POST", headers: authHeaders(), body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((body as { detail?: string }).detail ?? "Failed to upload statement.", res.status);
  }
  return (body as { job_id: string }).job_id;
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to fetch job.");
  }
  return body as Job;
}

export async function getResult(jobId: string): Promise<ParseResult> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/result`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to fetch result.");
  }
  return body as ParseResult;
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/jobs`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Failed to list jobs.");
  return (body as { jobs: Job[] }).jobs ?? [];
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to delete job.");
}

export async function getTemplates(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/templates`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Failed to fetch templates.");
  return (body as { banks: string[] }).banks ?? [];
}

export async function triggerExport(jobId: string, format: ExportFormat): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/export?format=${format}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Export failed.");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)/.exec(disposition);
  const filename = match?.[1] ?? `statement.${format}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function searchTransactions(params: SearchFilterParams): Promise<SearchResponse> {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") qs.append(k, String(v));
  });
  const res = await fetch(`${API_BASE}/search?${qs.toString()}`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Search failed.");
  }
  return body as SearchResponse;
}

export type TransactionEdit = {
  transaction_index: number;
  fields: Partial<Pick<Transaction, "date" | "value_date" | "description" | "reference" | "debit" | "credit" | "balance" | "category">>;
};

export async function applyEdits(jobId: string, edits: TransactionEdit[]): Promise<ParseResult> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/edits`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ edits }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to apply corrections.");
  }
  return body as ParseResult;
}

export async function uploadPdfs(files: File[]): Promise<string[]> {
  const ids: string[] = [];
  for (const file of files) {
    ids.push(await uploadPdf(file));
  }
  return ids;
}

export function healthCheck(): Promise<boolean> {
  return fetch(`${API_BASE}/health`, { method: "GET" })
    .then((r) => r.ok)
    .catch(() => false);
}

export async function getPlans(): Promise<PlansResponse> {
  const res = await fetch(`${API_BASE}/billing/plans`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Failed to fetch plans.");
  return body as PlansResponse;
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await fetch(`${API_BASE}/billing/me`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to fetch billing status.");
  }
  return body as BillingStatus;
}

export async function subscribeToPlan(plan: string, reference: string): Promise<BillingStatus> {
  const res = await fetch(`${API_BASE}/billing/subscribe`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ plan, reference }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Subscription failed.");
  }
  return body as BillingStatus;
}

export async function cancelSubscription(): Promise<BillingStatus> {
  const res = await fetch(`${API_BASE}/billing/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Could not cancel subscription.");
  }
  return body as BillingStatus;
}

// ------------------------------------------------------------------ //
// Accounting: companies, periods and financial statements
// ------------------------------------------------------------------ //
export async function listCompanies(): Promise<Company[]> {
  const res = await fetch(`${API_BASE}/companies`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to list companies.");
  }
  return (body as { companies: Company[] }).companies ?? [];
}

export async function listPeriods(companyId: string): Promise<AccountingPeriod[]> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/periods`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to list periods.");
  }
  return (body as { periods: AccountingPeriod[] }).periods ?? [];
}

export type ReportData = IncomeStatementReport | BalanceSheetReport | CashFlowReport;

export async function getReport(
  companyId: string,
  kind: ReportKind,
  periodId?: string,
): Promise<ReportData> {
  const qs = periodId ? `?period_id=${encodeURIComponent(periodId)}` : "";
  const res = await fetch(`${API_BASE}/companies/${companyId}/reports/${kind}${qs}`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to load report.");
  }
  return body as ReportData;
}

export async function downloadReportPdf(
  companyId: string,
  kind: ReportKind,
  periodId?: string,
): Promise<void> {
  await downloadReportFile(companyId, kind, periodId, "pdf");
}

export async function downloadReportXlsx(
  companyId: string,
  kind: ReportKind,
  periodId?: string,
): Promise<void> {
  await downloadReportFile(companyId, kind, periodId, "xlsx");
}

async function downloadReportFile(
  companyId: string,
  kind: ReportKind,
  periodId: string | undefined,
  ext: "pdf" | "xlsx",
): Promise<void> {
  const qs = periodId ? `?period_id=${encodeURIComponent(periodId)}` : "";
  const res = await fetch(`${API_BASE}/companies/${companyId}/reports/${kind}/${ext}${qs}`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? "Report download failed.");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)/.exec(disposition);
  const filename = match?.[1] ?? `${companyId}-${kind}.${ext}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ------------------------------------------------------------------ //
// Accounting: setup (companies, COA, periods, bank accounts, posting)
// ------------------------------------------------------------------ //
export async function createCompany(input: {
  name: string;
  trading_name?: string;
  industry?: string;
  country?: string;
  currency?: string;
  accounting_basis?: string;
}): Promise<Company> {
  const res = await fetch(`${API_BASE}/companies`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ generate_coa: true, ...input }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to create company.");
  }
  return body as Company;
}

export async function listChartOfAccounts(companyId: string): Promise<ChartAccount[]> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/chart-of-accounts`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to load chart of accounts.");
  }
  return (body as { accounts: ChartAccount[] }).accounts ?? [];
}

export async function generateCoa(companyId: string): Promise<ChartAccount[]> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/coa/generate`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ confirm: true }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to generate chart of accounts.");
  }
  return (body as { accounts: ChartAccount[] }).accounts ?? [];
}

export async function createPeriod(
  companyId: string,
  input: { name: string; start_date: string; end_date: string; status?: string },
): Promise<AccountingPeriod> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/periods`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to create period.");
  }
  return body as AccountingPeriod;
}

export async function createBankAccount(
  companyId: string,
  input: { name: string; bank_name?: string; account_number?: string; currency?: string },
): Promise<BankAccount> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/bank-accounts`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to create bank account.");
  }
  return body as BankAccount;
}

export async function listBankAccounts(companyId: string): Promise<BankAccount[]> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/bank-accounts`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to load bank accounts.");
  }
  return (body as { bank_accounts: BankAccount[] }).bank_accounts ?? [];
}

export async function runPosting(
  companyId: string,
  periodId?: string,
): Promise<{ posted: number; skipped: number; journal_ids: string[] }> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/posting/run`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(periodId ? { period_id: periodId } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Posting failed.");
  }
  return body as { posted: number; skipped: number; journal_ids: string[] };
}

// ------------------------------------------------------------------ //
// Accounting: statement linking & classification review
// ------------------------------------------------------------------ //
export async function listRawJobs(): Promise<RawJob[]> {
  const res = await fetch(`${API_BASE}/jobs?limit=200`, { headers: authHeaders() });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to list jobs.");
  }
  return (body as { jobs: RawJob[] }).jobs ?? [];
}

export async function linkStatement(
  companyId: string,
  input: { job_id: string; bank_account_id?: string; period_id?: string },
): Promise<CompanyStatement> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/statements`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to link statement.");
  }
  return body as CompanyStatement;
}

export async function listLinkedStatements(companyId: string): Promise<CompanyStatement[]> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/statements`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to list statements.");
  }
  return (body as { statements: CompanyStatement[] }).statements ?? [];
}

export async function unlinkStatement(companyId: string, statementId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/statements/${statementId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to unlink statement.");
  }
}

export async function classifyStatement(
  companyId: string,
  statementId: string,
): Promise<{ statement_id: string; imported: number; auto: number; review: number }> {
  const res = await fetch(
    `${API_BASE}/companies/${companyId}/statements/${statementId}/classify`,
    { method: "POST", headers: authHeaders() },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Classification failed.");
  }
  return body as { statement_id: string; imported: number; auto: number; review: number };
}

export async function listClassifications(
  companyId: string,
  status?: string,
): Promise<{ transactions: LedgerTxn[]; total: number }> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API_BASE}/companies/${companyId}/classifications${qs}`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to load review queue.");
  }
  return body as { transactions: LedgerTxn[]; total: number };
}

export async function approveClassification(companyId: string, txnId: string): Promise<LedgerTxn> {
  const res = await fetch(
    `${API_BASE}/companies/${companyId}/classifications/${txnId}/approve`,
    { method: "POST", headers: authHeaders() },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Approval failed.");
  }
  return body as LedgerTxn;
}

export async function rejectClassification(companyId: string, txnId: string): Promise<LedgerTxn> {
  const res = await fetch(
    `${API_BASE}/companies/${companyId}/classifications/${txnId}/reject`,
    { method: "POST", headers: authHeaders() },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Rejection failed.");
  }
  return body as LedgerTxn;
}

export async function reclassifyTransaction(
  companyId: string,
  txnId: string,
  accountCode: string,
  reason?: string,
): Promise<LedgerTxn> {
  const res = await fetch(
    `${API_BASE}/companies/${companyId}/classifications/${txnId}/reclassify`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ account_code: accountCode, reason }),
    },
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Reclassification failed.");
  }
  return body as LedgerTxn;
}

// ------------------------------------------------------------------ //
// Accounting: journals and trial balance (general ledger)
// ------------------------------------------------------------------ //
export async function listJournals(
  companyId: string,
  periodId?: string,
  limit = 200,
  offset = 0,
): Promise<JournalEntry[]> {
  const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (periodId) qs.append("period_id", periodId);
  const res = await fetch(`${API_BASE}/companies/${companyId}/journals?${qs.toString()}`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to list journals.");
  }
  return (body as { journals: JournalEntry[] }).journals ?? [];
}

export async function getJournal(companyId: string, journalId: string): Promise<JournalEntry> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/journals/${journalId}`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to load journal.");
  }
  return body as JournalEntry;
}

export async function getTrialBalance(
  companyId: string,
  periodId?: string,
): Promise<TrialBalance> {
  const qs = periodId ? `?period_id=${encodeURIComponent(periodId)}` : "";
  const res = await fetch(`${API_BASE}/companies/${companyId}/trial-balance${qs}`, {
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to load trial balance.");
  }
  return body as TrialBalance;
}

export async function reverseJournal(
  companyId: string,
  journalId: string,
  reason?: string,
): Promise<{ unposted: string; journal_no: string }> {
  const res = await fetch(`${API_BASE}/companies/${companyId}/journals/${journalId}/reverse`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(reason ? { reason } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to reverse journal.");
  }
  return body as { unposted: string; journal_no: string };
}

export interface DemoSeedResult {
  created: boolean;
  company: Company;
  period?: AccountingPeriod;
  bank_account?: { id: string; name: string };
  posted: number;
  skipped: number;
  message: string;
}

export async function seedDemo(): Promise<DemoSeedResult> {
  const res = await fetch(`${API_BASE}/demo/seed`, {
    method: "POST",
    headers: authHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to create demo data.");
  }
  return body as DemoSeedResult;
}
