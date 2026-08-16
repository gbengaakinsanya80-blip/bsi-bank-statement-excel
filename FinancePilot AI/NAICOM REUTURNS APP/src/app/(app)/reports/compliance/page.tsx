import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import { buildCalendarYear, type CalendarItem } from "@/lib/compliance/calendar";
import { getReturnDefinition } from "@/lib/returns/definitions";
import { listDemoReturns } from "@/lib/returns/demo-store";
import { listReturnInstances } from "@/lib/returns/return-service";
import { COMPLETED_STATUSES } from "@/lib/returns/status";
import { ExportButtons } from "@/components/reports/export-buttons";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Compliance Report" };

function statusBadge(status: string) {
  if (COMPLETED_STATUSES.includes(status)) return <Badge variant="success">Completed</Badge>;
  if (status === "OVERDUE") return <Badge variant="destructive">Overdue</Badge>;
  if (status === "NOT_STARTED") return <Badge variant="secondary">Not started</Badge>;
  return <Badge variant="warning">{status.replace(/_/g, " ")}</Badge>;
}

export default async function ComplianceReportPage() {
  const supabase = await createServerSupabase();
  const demo = !supabase;

  const instances = demo
    ? (await listDemoReturns()).map((r) => ({
        code: r.code,
        id: r.id,
        status: r.status,
        periodStart: r.period.start,
        periodEnd: r.period.end,
        qualityScore: 0,
      }))
    : (await listReturnInstances(supabase)).map((r) => ({
        code: r.code,
        id: r.id,
        status: r.status,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        qualityScore: r.qualityScore,
      }));

  const existing: Record<string, { id: string; status: string }> = {};
  for (const inst of instances) {
    existing[`${inst.code}|${inst.periodStart}|${inst.periodEnd}`] = {
      id: inst.id,
      status: inst.status,
    };
  }

  const year = new Date().getUTCFullYear();
  const calendar = buildCalendarYear(year, existing);

  const completed = calendar.filter((c) => COMPLETED_STATUSES.includes(c.status)).length;
  const overdue = calendar.filter((c) => c.status === "OVERDUE").length;
  const dueSoon = calendar.filter((c) => c.color === "ORANGE" || c.color === "YELLOW").length;
  const pending = calendar.filter((c) => c.status === "NOT_STARTED").length;

  const byCode = new Map<string, CalendarItem[]>();
  for (const item of calendar) {
    const list = byCode.get(item.code) ?? [];
    list.push(item);
    byCode.set(item.code, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6" />
          Compliance Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Regulatory return compliance for {year} — submission status, due dates and quality.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Completed" value={completed} tone="text-success" />
          <Stat label="Overdue" value={overdue} tone="text-destructive" />
          <Stat label="Due soon" value={dueSoon} tone="text-warning" />
          <Stat label="Not started" value={pending} />
        </div>
        <ExportButtons params={{ year: String(year) }} kind="compliance" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Return schedule status ({calendar.length} periods)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Days left</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calendar.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Nothing scheduled for {year}.
                  </TableCell>
                </TableRow>
              )}
              {calendar.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <span className="font-medium">{item.name}</span>
                    <p className="text-xs text-muted-foreground">{getReturnDefinition(item.code).frequency}</p>
                  </TableCell>
                  <TableCell>{item.periodLabel}</TableCell>
                  <TableCell>
                    {item.dueDate ? formatDate(item.dueDate) : "Requires confirmation"}
                  </TableCell>
                  <TableCell>{statusBadge(item.status)}</TableCell>
                  <TableCell>
                    {item.daysRemaining !== null ? (
                      item.daysRemaining < 0 ? (
                        <span className="text-destructive">{Math.abs(item.daysRemaining)}d overdue</span>
                      ) : (
                        `${item.daysRemaining}d`
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${tone ?? ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
