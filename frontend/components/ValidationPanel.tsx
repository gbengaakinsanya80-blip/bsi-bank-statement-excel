"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Copy, Eye, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ValidationIssue, ValidationReport } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ValidationPanelProps {
  report: ValidationReport;
}

const SECTIONS: { key: keyof Pick<ValidationReport, "missing_rows" | "balance_errors" | "duplicate_entries" | "unreadable_transactions" | "other_issues">; label: string }[] = [
  { key: "missing_rows", label: "Missing Rows" },
  { key: "balance_errors", label: "Balance Errors" },
  { key: "duplicate_entries", label: "Duplicate Entries" },
  { key: "unreadable_transactions", label: "Unreadable Transactions" },
  { key: "other_issues", label: "Other Issues" },
];

function SeverityBadge({ severity }: { severity: string }) {
  if (severity === "error")
    return <Badge variant="destructive">Error</Badge>;
  if (severity === "warning") return <Badge variant="warning">Warning</Badge>;
  return <Badge variant="secondary">Info</Badge>;
}

export function ValidationPanel({ report }: ValidationPanelProps) {
  const [open, setOpen] = React.useState<ValidationIssue | null>(null);
  const total = report.total_issues;

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Validation Report</CardTitle>
        {report.balance_reconciled ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="h-3 w-3" /> Reconciled
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <TriangleAlert className="h-3 w-3" /> Issues found
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-2xl font-bold tabular-nums">{total}</p>
            <p className="text-xs text-muted-foreground">Total issues</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-2xl font-bold tabular-nums">{report.balance_errors.length}</p>
            <p className="text-xs text-muted-foreground">Balance errors</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-2xl font-bold tabular-nums">
              {report.ocr_confidence !== null ? `${(report.ocr_confidence * 100).toFixed(0)}%` : "—"}
            </p>
            <p className="text-xs text-muted-foreground">OCR confidence</p>
          </div>
        </div>

        {SECTIONS.map(({ key, label }) => {
          const issues = report[key];
          return (
            <div key={key}>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-sm font-medium">{label}</p>
                <span className={cn("text-xs font-semibold tabular-nums", issues.length ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {issues.length}
                </span>
              </div>
              {issues.length === 0 ? (
                <p className="text-xs text-muted-foreground">None detected ✓</p>
              ) : (
                <ul className="space-y-1.5">
                  {issues.slice(0, 3).map((issue, i) => (
                    <li key={i}>
                      <button
                        className="w-full rounded-md border border-border bg-muted/40 p-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
                        onClick={() => setOpen(issue)}
                      >
                        <span className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="line-clamp-2">{issue.message}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                  {issues.length > 3 && (
                    <li className="text-center text-xs text-muted-foreground">
                      +{issues.length - 3} more…
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SeverityBadge severity={open?.severity ?? "info"} />
              {open?.issue_type.replaceAll("_", " ")}
            </DialogTitle>
            <DialogDescription>Details of the reported issue</DialogDescription>
          </DialogHeader>
          {open && (
            <div className="space-y-3 text-sm">
              <p>{open.message}</p>
              <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-xs">
                <span>Page: {open.page_number ?? "—"}</span>
                <span>Line: {open.line_number ?? "—"}</span>
                <span>
                  Expected: {open.expected?.toLocaleString("en", { maximumFractionDigits: 2 }) ?? "—"}
                </span>
                <span>
                  Actual: {open.actual?.toLocaleString("en", { maximumFractionDigits: 2 }) ?? "—"}
                </span>
              </div>
              {open.suggested_fix && (
                <div className="rounded-md border border-amber-300/40 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                  <p className="mb-1 flex items-center gap-1 font-semibold">
                    <Eye className="h-3.5 w-3.5" /> Suggested fix
                  </p>
                  {open.suggested_fix}
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full" onClick={() => navigator.clipboard.writeText(open.message)}>
                <Copy className="h-3.5 w-3.5" /> Copy message
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
