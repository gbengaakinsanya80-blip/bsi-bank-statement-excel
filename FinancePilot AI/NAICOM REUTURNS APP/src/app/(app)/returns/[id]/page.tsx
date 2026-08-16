import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CircleAlert, Download, Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PersonnelReturnTables, ReturnTable } from "@/components/returns/return-table";
import { ReturnStatusActions } from "@/components/returns/status-actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { getReturnInstance } from "@/lib/returns/return-service";
import { getDemoReturnView } from "@/lib/returns/demo-store";
import { RETURN_COLUMNS } from "@/lib/returns/columns";
import { statusVariant } from "@/lib/returns/status";
import { formatDate, formatDateTime, formatMoney, titleCase } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Return detail" };

export default async function ReturnDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const demo = !supabase;

  const instance = demo ? await getDemoReturnView(id) : await getReturnInstance(supabase, id);
  if (!instance) notFound();

  const isPersonnel = instance.code === "PERSONNEL";
  const columns = RETURN_COLUMNS[instance.code];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{instance.name}</h1>
            <Badge variant={statusVariant(instance.status)}>{titleCase(instance.status)}</Badge>
            <Badge variant="outline">{instance.code}</Badge>
            <Badge variant="outline">v{instance.versionNo}</Badge>
            {instance.formNumber && <Badge variant="outline">{instance.formNumber}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Period {instance.periodLabel} · {instance.frequency} · {instance.department}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ReturnStatusActions id={instance.id} status={instance.status} />
          <a
            href={`/api/returns/${instance.id}/export`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="h-4 w-4" />
            Export Excel
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Period start</p>
            <p className="text-sm font-semibold">{formatDate(instance.periodStart)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Period end</p>
            <p className="text-sm font-semibold">{formatDate(instance.periodEnd)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Rows</p>
            <p className="text-sm font-semibold">{instance.rowCount} line items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Generated</p>
            <p className="text-sm font-semibold">{formatDateTime(instance.createdAt)}</p>
          </CardContent>
        </Card>
      </div>

      {instance.totals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {instance.totals.map((t) => (
              <div key={t.label} className="rounded-md border bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">{t.label}</p>
                <p className="text-lg font-bold">
                  {isPersonnel
                    ? String(t.value)
                    : formatMoney(t.value, t.currency ?? "NGN")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {instance.quality && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Data quality
              {instance.quality.hasErrors ? (
                <Badge variant="destructive">{instance.quality.errorCount} error{instance.quality.errorCount === 1 ? "" : "s"}</Badge>
              ) : instance.quality.warningCount > 0 ? (
                <Badge variant="warning">{instance.quality.warningCount} warning{instance.quality.warningCount === 1 ? "" : "s"}</Badge>
              ) : (
                <Badge variant="success">Clean</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
              <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-primary/20 bg-primary/5">
                <span className="text-2xl font-bold">{instance.quality.score.toFixed(0)}%</span>
                <span className="text-[10px] text-muted-foreground">complete</span>
              </div>
              <div className="space-y-2">
                {instance.quality.issues.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No validation issues found. This return is ready for review.
                  </p>
                )}
                {instance.quality.issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    {issue.severity === "ERROR" ? (
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    ) : issue.severity === "WARNING" ? (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <p className={issue.severity === "ERROR" ? "text-destructive" : "text-muted-foreground"}>
                      {issue.message}
                    </p>
                  </div>
                ))}
                {instance.quality.hasErrors && (
                  <p className="text-xs text-destructive">
                    Resolve all errors before submitting this return for review.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            Line items{" "}
            {!isPersonnel && <span className="text-sm font-normal text-muted-foreground">({instance.rowCount})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isPersonnel ? (
            <PersonnelReturnTables rows={instance.rows} />
          ) : (
            <ReturnTable columns={columns ?? []} rows={instance.rows} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
