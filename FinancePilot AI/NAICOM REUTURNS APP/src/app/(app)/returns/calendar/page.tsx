import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  buildCalendar,
  buildCalendarYear,
  CALENDAR_COLOR_META,
  type CalendarColor,
  type CalendarItem,
  type DueDateRule,
} from "@/lib/compliance/calendar";
import { listDemoReturns } from "@/lib/returns/demo-store";
import { formatDate, titleCase } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Regulatory Calendar" };

const YEAR_OPTIONS = [2025, 2026, 2027];

function parseDateParam(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ColorBadge({ color, label }: { color: CalendarColor; label: string }) {
  const meta = CALENDAR_COLOR_META[color];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", meta.badge)}>
      <span className={cn("h-2 w-2 rounded-full", meta.dot)} />
      {label}
    </span>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; asOf?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createServerSupabase();
  const demo = !supabase;

  const today = parseDateParam(params.asOf) ?? new Date();
  const year = Number(params.year) || today.getUTCFullYear();

  let items: CalendarItem[];
  if (demo) {
    const demoReturns = await listDemoReturns();
    const existing: Record<string, { id: string; status: string }> = {};
    for (const r of demoReturns) {
      existing[`${r.code}|${r.period.start}|${r.period.end}`] = { id: r.id, status: r.status };
    }
    items = buildCalendarYear(year, existing, today);
  } else {
    const { data: definitions } = await supabase
      .from("return_definitions")
      .select("id, code, name, frequency")
      .eq("active", true);
    const { data: rules } = await supabase.from("due_date_rules").select("definition_id, rule");
    const { data: returns } = await supabase
      .from("returns")
      .select("id, definition_id, period_start, period_end, status");

    const defs = (definitions ?? []).map((d) => ({
      code: d.code,
      name: d.name,
      frequency: d.frequency as CalendarItem["frequency"],
    }));

    const defIdToCode = new Map((definitions ?? []).map((d) => [d.id, d.code]));
    const rulesByCode: Record<string, DueDateRule> = {};
    for (const r of rules ?? []) {
      const code = defIdToCode.get(r.definition_id);
      if (code) rulesByCode[code] = r.rule as DueDateRule;
    }

    const existing: Record<string, { id: string; status: string }> = {};
    for (const r of returns ?? []) {
      const code = defIdToCode.get(r.definition_id);
      if (code) existing[`${code}|${r.period_start}|${r.period_end}`] = { id: r.id, status: r.status };
    }

    items = buildCalendar(defs, year, existing, today, rulesByCode);
  }

  const counts: Record<CalendarColor, number> = { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0, GREY: 0 };
  for (const item of items) counts[item.color]++;

  const summary = [
    { color: "RED" as const, label: "Overdue", count: counts.RED },
    { color: "ORANGE" as const, label: "Due within 7 days", count: counts.ORANGE },
    { color: "YELLOW" as const, label: "Due within 14 days", count: counts.YELLOW },
    { color: "GREEN" as const, label: "Completed", count: counts.GREEN },
    { color: "GREY" as const, label: "Not due / requires confirmation", count: counts.GREY },
  ];

  const asOfSuffix = params.asOf ? `&asOf=${params.asOf}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regulatory Calendar</h1>
        <p className="text-sm text-muted-foreground">
          NAICOM due dates per return and reporting period. Colour coding: red = overdue, orange = due
          within 7 days, yellow = due within 14 days, green = completed.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {YEAR_OPTIONS.map((y) => (
          <Link
            key={y}
            href={`/returns/calendar?year=${y}${asOfSuffix}`}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              y === year ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {y}
          </Link>
        ))}
        {params.asOf && (
          <span className="ml-auto text-xs text-muted-foreground">
            As at {formatDate(today.toISOString())}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {summary.map((s) => (
          <Card key={s.color}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
              <span className={cn("h-3 w-3 rounded-full", CALENDAR_COLOR_META[s.color].dot)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar items for {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return</TableHead>
                <TableHead>Reporting period</TableHead>
                <TableHead>Period start</TableHead>
                <TableHead>Period end</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Days left</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div>
                        {item.returnId ? (
                          <Link href={`/returns/${item.returnId}`} className="font-medium text-primary hover:underline">
                            {item.name}
                          </Link>
                        ) : (
                          <p className="font-medium">{item.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{item.code}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{item.periodLabel}</TableCell>
                  <TableCell>{formatDate(item.periodStart)}</TableCell>
                  <TableCell>{formatDate(item.periodEnd)}</TableCell>
                  <TableCell>
                    {item.dueDate ? (
                      <div>
                        <p>{formatDate(item.dueDate)}</p>
                        {item.requiresConfirmation && (
                          <p className="text-xs text-warning">Unconfirmed</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Deadline requires confirmation</p>
                    )}
                  </TableCell>
                  <TableCell>
                    {item.daysRemaining === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : item.daysRemaining < 0 ? (
                      <span className="font-medium text-destructive">{Math.abs(item.daysRemaining)} days overdue</span>
                    ) : (
                      <span>{item.daysRemaining} day{item.daysRemaining === 1 ? "" : "s"}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1.5">
                      <Badge variant={item.color === "RED" ? "destructive" : item.color === "GREEN" ? "success" : "secondary"}>
                        {titleCase(item.status)}
                      </Badge>
                      <ColorBadge color={item.color} label={item.colorLabel} />
                    </div>
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
