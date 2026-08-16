import type { Metadata } from "next";
import { SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import {
  applyReportFilters,
  distinctValues,
  fetchReportRows,
  parseReportFilters,
  reportTotals,
} from "@/lib/services/reporting-service";
import { ReportFiltersForm } from "@/components/reports/report-filters";
import { ExportButtons } from "@/components/reports/export-buttons";
import { formatMoney, formatNumber } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Report Builder" };

export default async function ReportBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const filters = parseReportFilters(
    new URLSearchParams(
      Object.entries(sp).flatMap(([k, v]) => (v === undefined ? [] : [[k, Array.isArray(v) ? v.join(",") : v]]))
    )
  );

  const supabase = await createServerSupabase();
  const allRows = await fetchReportRows(supabase);
  const rows = applyReportFilters(allRows, filters);
  const totals = reportTotals(rows);

  const filterParams: Record<string, string> = {};
  for (const k of ["from", "to", "client", "insurer", "risk", "currency"] as const) {
    if (filters[k]) filterParams[k] = filters[k]!;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <SlidersHorizontal className="h-6 w-6" />
          Report Builder
        </h1>
        <p className="text-sm text-muted-foreground">
          Build a custom report — filter by date, client, insurer, risk class and currency, then
          export to Excel or CSV.
        </p>
      </div>

      <ReportFiltersForm
        basePath="/reports/builder"
        filters={filters}
        clients={distinctValues(allRows, "client_name")}
        insurers={distinctValues(allRows, "insurer_name")}
        risks={distinctValues(allRows, "risk_type")}
        currencies={distinctValues(allRows, "currency")}
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            Results ({rows.length} policies)
          </CardTitle>
          <ExportButtons params={filterParams} kind="builder" />
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy No.</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead>Risk class</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Date</TableHead>
                <TableHead className="text-right">Gross premium</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Paid to insurer</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No policies match the current filters.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.policy_number ?? "—"}</TableCell>
                  <TableCell>{r.client_name ?? "—"}</TableCell>
                  <TableCell>{r.insurer_name ?? "—"}</TableCell>
                  <TableCell>{r.risk_type ?? "—"}</TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.transaction_date ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.gross_premium, r.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.premium_collected, r.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.premium_paid_to_insurer, r.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(r.brokerage_commission, r.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <span>
            Total gross premium:{" "}
            <span className="font-semibold text-foreground">
              {formatMoney(totals.gross_premium, "NGN")}
            </span>
          </span>
          <span>
            Commission:{" "}
            <span className="font-semibold text-foreground">
              {formatMoney(totals.brokerage_commission, "NGN")}
            </span>
          </span>
          <span>
            Outstanding:{" "}
            <span className="font-semibold text-foreground">
              {formatMoney(totals.outstanding, "NGN")}
            </span>
          </span>
          <span>
            Policies: <span className="font-semibold text-foreground">{formatNumber(totals.count)}</span>
          </span>
        </div>
      )}
    </div>
  );
}
