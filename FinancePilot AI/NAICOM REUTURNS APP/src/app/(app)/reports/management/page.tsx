import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  fetchReportRows,
  groupBy,
  monthlyTrend,
  reportTotals,
} from "@/lib/services/reporting-service";
import { MonthlyTrendChart, GroupedBarChart } from "@/components/reports/analytics-charts";
import { ExportButtons } from "@/components/reports/export-buttons";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Management Reports" };

export default async function ManagementReportsPage() {
  const supabase = await createServerSupabase();
  const rows = await fetchReportRows(supabase);
  const totals = reportTotals(rows);
  const trend = monthlyTrend(rows);
  const byInsurer = groupBy(rows, "insurer_name");
  const byClass = groupBy(rows, "risk_type");
  const byClient = groupBy(rows, "client_name");

  const cards = [
    { label: "Policies", value: formatNumber(totals.count), sub: "In report scope" },
    { label: "Gross premium", value: formatMoney(totals.gross_premium, "NGN"), sub: "All-time" },
    { label: "Premium collected", value: formatMoney(totals.premium_collected, "NGN"), sub: `${Math.round((totals.premium_collected / Math.max(totals.gross_premium, 1)) * 100)}% of gross` },
    { label: "Outstanding", value: formatMoney(totals.outstanding, "NGN"), sub: "Collected not yet remitted" },
    { label: "Commission earned", value: formatMoney(totals.brokerage_commission, "NGN"), sub: "Brokerage" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <BarChart3 className="h-6 w-6" />
          Management Reports
        </h1>
        <p className="text-sm text-muted-foreground">
          Executive charts — premium, commission and outstanding trends, and business by
          insurer, risk class and client.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Monthly trend</h2>
        <ExportButtons params={{}} kind="premium" />
      </div>
      <Card>
        <CardContent className="pt-4">
          {trend.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              No policy data to chart yet. Add policies or import a workbook.
            </p>
          ) : (
            <MonthlyTrendChart data={trend} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gross premium by insurer</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart data={byInsurer} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gross premium by risk class</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart data={byClass} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gross premium by client</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupedBarChart data={byClient} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top clients by commission</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Policies</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byClient.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No data yet.
                    </TableCell>
                  </TableRow>
                )}
                {byClient.slice(0, 10).map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{formatNumber(c.count)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(c.brokerage_commission, "NGN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/reports/premium"
          className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent"
        >
          Premium report <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          href="/reports/commission"
          className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent"
        >
          Commission report <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          href="/reports/compliance"
          className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent"
        >
          Compliance report <ChevronRight className="h-4 w-4" />
        </Link>
        <Link
          href="/reports/builder"
          className="inline-flex items-center gap-1 rounded-md border bg-card px-3 py-2 text-sm font-medium shadow-sm hover:bg-accent"
        >
          Report builder <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      {totals.count > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">Data quality</Badge>
          {totals.outstanding === 0
            ? "No outstanding premiums — all collections remitted."
            : `${formatMoney(totals.outstanding, "NGN")} outstanding (collected but not yet remitted to insurers).`}
        </p>
      )}
    </div>
  );
}
