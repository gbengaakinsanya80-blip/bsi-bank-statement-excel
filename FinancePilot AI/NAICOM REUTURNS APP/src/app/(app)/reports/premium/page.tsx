import type { Metadata } from "next";
import { Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  applyReportFilters,
  distinctValues,
  fetchReportRows,
  monthlyTrend,
  parseReportFilters,
  reportTotals,
} from "@/lib/services/reporting-service";
import { ReportFiltersForm } from "@/components/reports/report-filters";
import { ExportButtons } from "@/components/reports/export-buttons";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Premium Report" };

export default async function PremiumReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const filters = parseReportFilters(new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(",") : v]]))));

  const supabase = await createServerSupabase();
  const allRows = await fetchReportRows(supabase);
  const rows = applyReportFilters(allRows, filters);
  const totals = reportTotals(rows);
  const trend = monthlyTrend(rows);

  const filterParams: Record<string, string> = {};
  for (const k of ["from", "to", "client", "insurer", "risk", "currency"] as const) {
    if (filters[k]) filterParams[k] = filters[k]!;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Wallet className="h-6 w-6" />
          Premium Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Collections, remittances and outstanding premiums. Filter and export to Excel or CSV.
        </p>
      </div>

      <ReportFiltersForm
        basePath="/reports/premium"
        filters={filters}
        clients={distinctValues(allRows, "client_name")}
        insurers={distinctValues(allRows, "insurer_name")}
        risks={distinctValues(allRows, "risk_type")}
        currencies={distinctValues(allRows, "currency")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Policies" value={formatNumber(totals.count)} />
        <SummaryCard label="Gross premium" value={formatMoney(totals.gross_premium, "NGN")} />
        <SummaryCard label="Premium collected" value={formatMoney(totals.premium_collected, "NGN")} />
        <SummaryCard label="Paid to insurers" value={formatMoney(totals.premium_paid_to_insurer, "NGN")} />
        <SummaryCard label="Outstanding" value={formatMoney(totals.outstanding, "NGN")} accent={totals.outstanding > 0} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Monthly summary</CardTitle>
          <ExportButtons params={filterParams} kind="premium" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Policies</TableHead>
                <TableHead className="text-right">Gross premium</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Paid to insurer</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trend.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No policies match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {trend.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(m.gross_premium, "NGN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(m.premium_collected, "NGN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(m.premium_paid_to_insurer, "NGN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(m.outstanding, "NGN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(m.brokerage_commission, "NGN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${accent ? "text-warning" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
