"use client";

import * as React from "react";
import Link from "next/link";
import { Eye, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { deleteJob, listJobs } from "@/lib/api";
import type { Job } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const STATUS_LABEL: Record<Job["status"], { label: string; variant: "default" | "secondary" | "success" | "destructive" | "warning" }> = {
  queued: { label: "Queued", variant: "secondary" },
  running: { label: "Running", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function HistoryPage() {
  const [jobs, setJobs] = React.useState<Job[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      setJobs(await listJobs());
    } catch {
      setError("Could not reach the API. Is the backend running?");
    }
  }, []);

  React.useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const handleDelete = async (id: string) => {
    await deleteJob(id);
    refresh();
  };

  return (
    <main className="container py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Processing History</h1>
          <p className="text-sm text-muted-foreground">Every statement you have processed on this server.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {!jobs ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No jobs yet. Upload a statement on the dashboard to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {jobs.map((job) => {
            const status = STATUS_LABEL[job.status] ?? STATUS_LABEL.queued;
            return (
              <Card key={job.job_id}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="min-w-[200px] flex-1">
                    <p className="truncate text-sm font-semibold">{job.filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.summary?.bank_name ? `${job.summary.bank_name} · ` : ""}
                      {job.summary?.transaction_count != null
                        ? `${job.summary.transaction_count} txns · `
                        : ""}
                      {job.created_at ? new Date(job.created_at).toLocaleString() : ""}
                    </p>
                    {job.error && <p className="mt-1 text-xs text-destructive">{job.error}</p>}
                  </div>

                  <div className="w-36">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate">{job.message}</span>
                      <span className="tabular-nums">{Math.round(job.progress)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </div>

                  <Badge variant={status.variant}>{status.label}</Badge>

                  <div className="flex items-center gap-1.5">
                    {job.status === "completed" && (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/?job=${job.job_id}`}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </Link>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(job.job_id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
