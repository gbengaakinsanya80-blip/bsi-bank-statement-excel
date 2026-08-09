"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, FileSpreadsheet, Layers, Pencil, Wand2 } from "lucide-react";
import { Landing } from "@/components/Landing";
import { AccountHeadsPanel } from "@/components/AccountHeadsPanel";
import { applyEdits, ApiError, getJob, getResult, triggerExport, uploadPdf, uploadPdfs, type TransactionEdit } from "@/lib/api";
import type { ExportFormat, ParseResult, Transaction } from "@/lib/types";
import { UploadDropzone } from "@/components/UploadDropzone";
import { ProgressBar, StepIndicator } from "@/components/ProgressBar";
import { SummaryCards } from "@/components/SummaryCards";
import { ValidationPanel } from "@/components/ValidationPanel";
import { InsightsPanel } from "@/components/InsightsPanel";
import { TransactionsTable, type Row } from "@/components/TransactionsTable";
import { Filters, EMPTY_FILTERS, type FiltersState } from "@/components/Filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STEPS = ["Read PDF", "Detect layout", "Extract", "Validate"];

function presetDateRange(
  preset: FiltersState["preset"],
  now = new Date(),
): { from: string | null; to: string | null } {
  const iso = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
  };
  switch (preset) {
    case "today": {
      const t = iso(now);
      return { from: t, to: t };
    }
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const t = iso(y);
      return { from: t, to: t };
    }
    case "this_month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(first), to: iso(now) };
    }
    default:
      return { from: null, to: null };
  }
}

export default function Home() {
  return (
    <React.Suspense
      fallback={
        <main className="container flex items-center justify-center py-32 text-muted-foreground">Loading…</main>
      }
    >
      <HomeContent />
    </React.Suspense>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const [jobId, setJobId] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [parsed, setParsed] = React.useState<ParseResult | null>(null);
  const [phase, setPhase] = React.useState<"idle" | "processing" | "done" | "error">("idle");
  const [progress, setProgress] = React.useState(0);
  const [message, setMessage] = React.useState("Queued…");
  const [error, setError] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<FiltersState>(EMPTY_FILTERS);
  const [exporting, setExporting] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [batch, setBatch] = React.useState<{ id: string; name: string }[] | null>(null);
  const [batchIndex, setBatchIndex] = React.useState(0);
  const [quotaError, setQuotaError] = React.useState(false);

  const pollJob = React.useCallback(async (id: string): Promise<ParseResult> => {
    setPhase("processing");
    setProgress(2);
    setMessage("Queued…");
    for (;;) {
      await new Promise((r) => setTimeout(r, 700));
      let job;
      try {
        job = await getJob(id);
      } catch {
        setError("Lost contact with the API while processing.");
        setPhase("error");
        throw new Error("Lost contact with the API while processing.");
      }
      setProgress(job.progress);
      setMessage(job.message);
      if (job.status === "completed") {
        const result = await getResult(id);
        setParsed(result);
        setProgress(100);
        setPhase("done");
        return result;
      }
      if (job.status === "failed") {
        const msg = job.error ?? "Processing failed.";
        setError(msg);
        setPhase("error");
        throw new Error(msg);
      }
    }
  }, []);

  const loadFromQuery = React.useCallback(async (id: string) => {
    try {
      const job = await getJob(id);
      if (job.status === "completed") {
        const result = await getResult(id);
        setJobId(id);
        setParsed(result);
        setPhase("done");
      } else {
        setJobId(id);
        await pollJob(id);
      }
    } catch {
      setError("That job could not be loaded.");
      setPhase("error");
    }
  }, [pollJob]);

  React.useEffect(() => {
    const fromQuery = searchParams.get("job");
    if (fromQuery && !jobId) {
      loadFromQuery(fromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleFile = async (files: File[]) => {
    if (files.length === 0) return;
    setFile(files[0]);
    setBatch(null);
    setEditing(false);
    setQuotaError(false);
    setParsed(null);
    setError(null);
    setPhase("processing");
    setProgress(2);
    setMessage("Uploading…");
    let ids: string[];
    try {
      ids = files.length === 1 ? [await uploadPdf(files[0])] : await uploadPdfs(files);
    } catch (e) {
      setQuotaError(e instanceof ApiError && e.status === 402);
      setError(e instanceof Error ? e.message : "Upload failed.");
      setPhase("error");
      return;
    }
    setJobId(ids[0]);
    setBatch(
      files.map((f, i) => ({
        id: ids[i],
        name: f.name,
      })),
    );
    setBatchIndex(0);

    const results: ParseResult[] = [];
    for (let i = 0; i < ids.length; i++) {
      setMessage(`Processing ${i + 1} of ${ids.length}: ${files[i].name}`);
      setProgress(Math.round((i / Math.max(1, ids.length)) * 100));
      setBatchIndex(i);
      try {
        results.push(await pollJob(ids[i]));
      } catch {
        return;
      }
    }
    if (results.length > 0) {
      setParsed(results[0]);
      setPhase("done");
    }
  };

  const handleApplyEdits = async (edits: TransactionEdit[]) => {
    if (!jobId) return;
    try {
      const result = await applyEdits(jobId, edits);
      setParsed(result);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to apply corrections.");
    }
  };

  const handleExport = async (format: ExportFormat) => {
    if (!jobId) return;
    setExporting(true);
    try {
      await triggerExport(jobId, format);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const filteredRows = React.useMemo<Row[]>(() => {
    if (!parsed) return [];
    const { from, to } = presetDateRange(filters.preset);
    const effFrom = filters.preset === "custom" ? filters.date_from : (from ?? "");
    const effTo = filters.preset === "custom" ? filters.date_to : (to ?? "");
    const matches = (t: Transaction): boolean => {
      if (t.is_ending_balance) return true;
      const q = filters.q.trim().toLowerCase();
      if (q && !t.description.toLowerCase().includes(q) && !t.reference.toLowerCase().includes(q)) return false;
      if (effFrom && t.date && t.date < effFrom) return false;
      if (effTo && t.date && t.date > effTo) return false;
      if (filters.direction === "debit" && t.debit === null) return false;
      if (filters.direction === "credit" && t.credit === null) return false;
      if (filters.category && t.category !== filters.category) return false;
      const amount = t.debit ?? t.credit ?? 0;
      if (filters.amount_min && amount < Number(filters.amount_min)) return false;
      if (filters.amount_max && amount > Number(filters.amount_max)) return false;
      return true;
    };
    const rows: Row[] = [];
    parsed.transactions.forEach((t, i) => {
      if (matches(t)) rows.push({ ...t, i });
    });
    return rows;
  }, [parsed, filters]);

  const meta = parsed?.meta;
  const detectedFields = parsed?.columns_detected.columns.map((c) => c.field).join(", ");

  const categories = React.useMemo(() => {
    if (!parsed) return [];
    const set = new Set<string>();
    for (const t of parsed.transactions) {
      if (t.category && !t.is_beginning_balance && !t.is_ending_balance) set.add(t.category);
    }
    return Array.from(set).sort();
  }, [parsed]);

  return (
    <main>
      {phase === "idle" && <Landing onFiles={handleFile} />}

      {phase !== "idle" && (
        <div className="container py-8">
      {phase === "processing" && (
        <div className="mx-auto max-w-2xl space-y-6">
          <UploadDropzone onFiles={handleFile} disabled multiple />
          <Card>
            <CardContent className="space-y-5 p-6">
              <StepIndicator
                steps={STEPS}
                current={progress < 25 ? 0 : progress < 55 ? 1 : progress < 80 ? 2 : 3}
              />
              <ProgressBar value={progress} label={`${message}${file ? ` — ${file.name}` : ""}`} />
              {batch && batch.length > 1 && (
                <p className="text-center text-xs text-muted-foreground">
                  Batch of {batch.length} statements · {batchIndex + 1} of {batch.length} loaded
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "error" && (
        <div className="mx-auto max-w-2xl space-y-4">
          <UploadDropzone onFiles={handleFile} multiple />
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-5">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-semibold">{quotaError ? "Monthly limit reached" : "Processing failed"}</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                {quotaError && (
                  <Button asChild size="sm" className="mt-2">
                    <Link href="/pricing">Upgrade to Pro</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {phase === "done" && parsed && (
        <div className="space-y-6">
          {batch && batch.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Layers className="h-3.5 w-3.5" />
                Batch
              </span>
              {batch.map((b, i) => (
                <Button
                  key={b.id}
                  size="sm"
                  variant={i === batchIndex ? "default" : "outline"}
                  className="max-w-[220px] truncate"
                  onClick={() => {
                    setBatchIndex(i);
                    setJobId(b.id);
                    getResult(b.id).then(setParsed).catch(() => setError("Could not load this statement."));
                  }}
                >
                  {b.name}
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold leading-tight">{meta?.bank_name || "Bank"} Statement</h2>
                <p className="text-xs text-muted-foreground">
                  {meta?.file_name} · {meta?.account_number || "Account N/A"} · {meta?.currency} ·{" "}
                  {meta?.total_pages_processed} page{meta && meta.total_pages_processed !== 1 ? "s" : ""} ·{" "}
                  {(meta?.parse_time_seconds ?? 0).toFixed(1)}s · {meta?.extraction_method}
                  {meta?.ocr_used ? " + OCR" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={parsed.validation.balance_reconciled ? "success" : "warning"}>
                {parsed.validation.balance_reconciled ? "Balances reconciled" : "Check validation"}
              </Badge>
              <Badge variant="outline">{parsed.summary.number_of_transactions.toLocaleString()} transactions</Badge>
              <Button
                size="sm"
                variant={editing ? "default" : "outline"}
                onClick={() => setEditing((e) => !e)}
              >
                {editing ? <Wand2 className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {editing ? "Done correcting" : "Correct data"}
              </Button>
            </div>
          </div>

          <SummaryCards summary={parsed.summary} />

          <AccountHeadsPanel heads={parsed.account_heads ?? []} currency={parsed.summary.currency} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="mb-4 p-4">
                <Filters value={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} categories={categories} />
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing {filteredRows.length} of {parsed.transactions.length} records
                </p>
              </Card>
              <TransactionsTable
                rows={filteredRows}
                exporting={exporting}
                onExport={handleExport}
                editable={editing}
                onApplyEdits={handleApplyEdits}
              />
            </div>
            <div className="space-y-4">
              <ValidationPanel report={parsed.validation} />
              <InsightsPanel insights={parsed.insights} currency={parsed.summary.currency} summary={parsed.summary} />
            </div>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground">
            <p>
              Detected columns:{" "}
              <span className="font-medium text-foreground">{detectedFields || "—"}</span>
              <span className="ml-2">· method: {parsed.columns_detected.source}</span>
            </p>
            <div className="flex items-center gap-3">
              <p>Export to:</p>
              <div className="flex gap-1.5">
                {(["xlsx", "csv", "json", "pdf", "sqlite"] as const).map((f) => (
                  <Button key={f} size="sm" variant="outline" disabled={exporting} onClick={() => handleExport(f)}>
                    .{f.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          </footer>
        </div>
      )}
        </div>
      )}
    </main>
  );
}
