import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  applyReportFilters,
  fetchReportRows,
  groupBy,
  monthlyTrend,
  reportTotals,
  type ReportFilters,
} from "@/lib/services/reporting-service";
import {
  buildReportCsv,
  buildReportWorkbook,
  reportFilename,
  type ReportTableSpec,
} from "@/lib/reports/exports";
import { formatMoney, formatDate } from "@/lib/utils/format";
import { buildCalendarYear, type CalendarItem } from "@/lib/compliance/calendar";
import { getReturnDefinition } from "@/lib/returns/definitions";
import { listDemoReturns } from "@/lib/returns/demo-store";
import { listReturnInstances } from "@/lib/returns/return-service";

export const dynamic = "force-dynamic";

const money = (v: number, currency = "NGN") => formatMoney(v, currency);

function filtersFromRequest(url: URL): ReportFilters {
  return {
    from: url.searchParams.get("from")?.slice(0, 10) || undefined,
    to: url.searchParams.get("to")?.slice(0, 10) || undefined,
    client: url.searchParams.get("client") || undefined,
    insurer: url.searchParams.get("insurer") || undefined,
    risk: url.searchParams.get("risk") || undefined,
    currency: url.searchParams.get("currency") || undefined,
  };
}

function premiumTables(rows: Awaited<ReturnType<typeof fetchReportRows>>) {
  const total = reportTotals(rows);
  const detail: ReportTableSpec = {
    name: "Premium report",
    title: "PREMIUM REPORT - COLLECTIONS, REMITTANCES & OUTSTANDING",
    columns: [
      "Policy No.",
      "Client",
      "Insurer",
      "Risk class",
      "Date",
      "Gross premium",
      "Premium collected",
      "Paid to insurer",
      "Outstanding",
      "Commission",
    ],
    rows: rows.map((r) => [
      r.policy_number,
      r.client_name,
      r.insurer_name,
      r.risk_type,
      r.transaction_date,
      money(r.gross_premium),
      money(r.premium_collected),
      money(r.premium_paid_to_insurer),
      money(r.premium_collected - r.premium_paid_to_insurer),
      money(r.brokerage_commission),
    ]),
  };
  const summary: ReportTableSpec = {
    name: "Summary",
    title: "SUMMARY",
    columns: ["Metric", "Value"],
    rows: [
      ["Policies", String(total.count)],
      ["Gross premium", money(total.gross_premium)],
      ["Premium collected", money(total.premium_collected)],
      ["Paid to insurer", money(total.premium_paid_to_insurer)],
      ["Outstanding", money(total.outstanding)],
      ["Commission", money(total.brokerage_commission)],
    ],
  };
  const monthly: ReportTableSpec = {
    name: "Monthly trend",
    title: "MONTHLY TREND",
    columns: ["Month", "Policies", "Gross premium", "Collected", "Paid to insurer", "Outstanding", "Commission"],
    rows: monthlyTrend(rows).map((m) => [
      m.label,
      String(m.count),
      money(m.gross_premium),
      money(m.premium_collected),
      money(m.premium_paid_to_insurer),
      money(m.outstanding),
      money(m.brokerage_commission),
    ]),
  };
  return { tables: [summary, monthly, detail], detail };
}

function commissionTables(
  rows: Awaited<ReturnType<typeof fetchReportRows>>,
  group: "client_name" | "insurer_name" | "risk_type"
) {
  const grouped = groupBy(rows, group);
  const label =
    group === "client_name" ? "CLIENT" : group === "insurer_name" ? "INSURER" : "RISK CLASS";
  const table: ReportTableSpec = {
    name: `Commission by ${label.toLowerCase()}`,
    title: `COMMISSION REPORT BY ${label}`,
    columns: [label, "Policies", "Gross premium", "Commission"],
    rows: grouped.map((g) => [
      g.name,
      String(g.count),
      money(g.gross_premium),
      money(g.brokerage_commission),
    ]),
  };
  const total = reportTotals(rows);
  const summary: ReportTableSpec = {
    name: "Summary",
    title: "SUMMARY",
    columns: ["Metric", "Value"],
    rows: [
      ["Policies", String(total.count)],
      ["Gross premium", money(total.gross_premium)],
      ["Commission", money(total.brokerage_commission)],
    ],
  };
  return { tables: [summary, table], table };
}

function builderTable(rows: Awaited<ReturnType<typeof fetchReportRows>>) {
  return {
    name: "Report",
    title: "REPORT",
    columns: [
      "Policy No.",
      "Client",
      "Insurer",
      "Risk class",
      "Currency",
      "Date",
      "Gross premium",
      "Premium collected",
      "Paid to insurer",
      "Outstanding",
      "Commission",
    ],
    rows: rows.map((r) => [
      r.policy_number,
      r.client_name,
      r.insurer_name,
      r.risk_type,
      r.currency,
      r.transaction_date,
      money(r.gross_premium, r.currency),
      money(r.premium_collected, r.currency),
      money(r.premium_paid_to_insurer, r.currency),
      money(r.premium_collected - r.premium_paid_to_insurer, r.currency),
      money(r.brokerage_commission, r.currency),
    ]),
  };
}

async function complianceTables(supabase: Awaited<ReturnType<typeof createServerSupabase>>, yearParam: string | null) {
  const year = Number(yearParam) || new Date().getUTCFullYear();
  const demo = !supabase;

  const instances = demo
    ? (await listDemoReturns()).map((r) => ({
        code: r.code,
        id: r.id,
        status: r.status,
        periodStart: r.period.start,
        periodEnd: r.period.end,
      }))
    : (await listReturnInstances(supabase!)).map((r) => ({
        code: r.code,
        id: r.id,
        status: r.status,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
      }));

  const existing: Record<string, { id: string; status: string }> = {};
  for (const inst of instances) {
    existing[`${inst.code}|${inst.periodStart}|${inst.periodEnd}`] = {
      id: inst.id,
      status: inst.status,
    };
  }

  const calendar: CalendarItem[] = buildCalendarYear(year, existing);
  const table: ReportTableSpec = {
    name: "Compliance",
    title: `COMPLIANCE REPORT ${year}`,
    columns: ["Return", "Frequency", "Period", "Due date", "Status", "Days left"],
    rows: calendar.map((c) => [
      getReturnDefinition(c.code).name,
      getReturnDefinition(c.code).frequency,
      c.periodLabel,
      c.dueDate ? formatDate(c.dueDate) : "Requires confirmation",
      c.status,
      c.daysRemaining !== null ? String(c.daysRemaining) : null,
    ]),
  };
  return { tables: [table], table };
}

export async function GET(request: Request) {
  await requireAppUser();

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "builder";
  const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";
  const rawGroup = url.searchParams.get("group");
  const group: "client_name" | "insurer_name" | "risk_type" =
    rawGroup === "insurer_name" || rawGroup === "risk_type" ? rawGroup : "client_name";

  const supabase = await createServerSupabase();
  const filters = filtersFromRequest(url);
  const allRows = await fetchReportRows(supabase);
  const rows = applyReportFilters(allRows, filters);

  let tables: ReportTableSpec[];
  let primary: ReportTableSpec;
  let base = "report";

  if (kind === "premium") {
    const built = premiumTables(rows);
    tables = built.tables;
    primary = built.detail;
    base = "premium-report";
  } else if (kind === "commission") {
    const built = commissionTables(rows, group);
    tables = built.tables;
    primary = built.table;
    base = `commission-report-by-${group.replace("_name", "")}`;
  } else if (kind === "compliance") {
    const built = await complianceTables(supabase, url.searchParams.get("year"));
    tables = built.tables;
    primary = built.table;
    base = "compliance-report";
  } else {
    primary = builderTable(rows);
    tables = [primary];
    base = "report-builder";
  }

  if (format === "csv") {
    const csv = buildReportCsv(primary.columns, primary.rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${reportFilename(base, "csv")}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const buffer = buildReportWorkbook(base.replace(/-/g, " ").toUpperCase(), tables);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${reportFilename(base, "xlsx")}"`,
      "Content-Length": String(buffer.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
