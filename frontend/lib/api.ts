import { getToken } from "./auth";
import type { AuthUser } from "./auth";
import type { BillingStatus, ExportFormat, Job, ParseResult, PlansResponse, SearchFilterParams, SearchResponse, Transaction } from "./types";

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
