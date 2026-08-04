import type { ExportFormat, Job, ParseResult, SearchFilterParams, SearchResponse, Transaction } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

export async function uploadPdf(file: File): Promise<string> {
  const form = new FormData();
  form.append("upload", file);
  const res = await fetch(`${API_BASE}/process`, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to upload statement.");
  }
  return (body as { job_id: string }).job_id;
}

export async function getJob(jobId: string): Promise<Job> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to fetch job.");
  }
  return body as Job;
}

export async function getResult(jobId: string): Promise<ParseResult> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/result`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { detail?: string }).detail ?? "Failed to fetch result.");
  }
  return body as ParseResult;
}

export async function listJobs(): Promise<Job[]> {
  const res = await fetch(`${API_BASE}/jobs`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Failed to list jobs.");
  return (body as { jobs: Job[] }).jobs ?? [];
}

export async function deleteJob(jobId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete job.");
}

export async function getTemplates(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/templates`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error("Failed to fetch templates.");
  return (body as { banks: string[] }).banks ?? [];
}

export async function triggerExport(jobId: string, format: ExportFormat): Promise<void> {
  const res = await fetch(`${API_BASE}/jobs/${jobId}/export?format=${format}`);
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
  const res = await fetch(`${API_BASE}/search?${qs.toString()}`);
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
    headers: { "Content-Type": "application/json" },
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
