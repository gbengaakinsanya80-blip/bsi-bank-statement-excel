import type { Metadata } from "next";
import { Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import { applyReportFilters, fetchReportRows, groupBy, reportTotals } from "@/lib/services/reporting-service";
import { ReportFiltersForm } from "@/components/reports/report-filters";
import { ExportButtons } from "@/components/reports/export-buttons";
import { formatMoney } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Commission Report" };

function CommissionTable({
  title,
  points,
  group,
  filters,
}: {
  title: string;
  points: ReturnType<typeof groupBy>;
  group: "client_name" | "insurer_name" | "risk_type";
  filters: Record<string, string>;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <ExportButtons params={filters} kind="commission" group={group} />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Policies</TableHead>
              <TableHead className="text-right">Gross premium</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Rate</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No data matches the current filters.
                </TableCell>
              </TableRow>
            )}
            {points.map((p) => (
              <TableRow key={p.name}>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell className="text-right tabular-nums">{p.count}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(p.gross_premium, "NGN")}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(p.brokerage_commission, "NGN")}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {p.gross_premium > 0 ? `${((p.brokerage_commission / p.gross_premium) * 100).toFixed(1)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default async function CommissionReportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const filters = {
    from: sp.from ? String(sp.from).slice(0, 10) : undefined,
    to: sp.to ? String(sp.to).slice(0, 10) : undefined,
    client: sp.client ? String(sp.client) : undefined,
    insurer: sp.insurer ? String(sp.insurer) : undefined,
    risk: sp.risk ? String(sp.risk) : undefined,
    currency: sp.currency ? String(sp.currency) : undefined,
  };

  const supabase = await createServerSupabase();
  const allRows = await fetchReportRows(supabase);
  const rows = applyReportFilters(allRows, filters);
  const totals = reportTotals(rows);

  const filterParams: Record<string, string> = {};
  for (const k of ["from", "to", "client", "insurer", "risk", "currency"] as const) {
    if (filters[k]) filterParams[k] = filters[k]!;
  }

  const byClass = groupBy(rows, "risk_type");
  const byInsurer = groupBy(rows, "insurer_name");
  const byClient = groupBy(rows, "client_name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Percent className="h-6 w-6" />
          Commission Report
        </h1>
        <p className="text-sm text-muted-foreground">
          Brokerage commission earned, analysed by risk class, insurer and client.
        </p>
      </div>

      <ReportFiltersForm
        basePath="/reports/commission"
        filters={filters}
        clients={[...new Set(allRows.map((r) => r.client_name).filter(Boolean) as string[])].sort()}
        insurers={[...new Set(allRows.map((r) => r.insurer_name).filter(Boolean) as string[])].sort()}
        risks={[...new Set(allRows.map((r) => r.risk_type).filter(Boolean) as string[])].sort()}
        currencies={[...new Set(allRows.map((r) => r.currency))].sort()}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total commission</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatMoney(totals.brokerage_commission, "NGN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Gross premium</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{formatMoney(totals.gross_premium, "NGN")}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Effective rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              {totals.gross_premium > 0
                ? `${((totals.brokerage_commission / totals.gross_premium) * 100).toFixed(2)}%`
                : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <CommissionTable title="By risk class" points={byClass} group="risk_type" filters={filterParams} />
      <CommissionTable title="By insurer" points={byInsurer} group="insurer_name" filters={filterParams} />
      <CommissionTable title="By client" points={byClient} group="client_name" filters={filterParams} />
    </div>
  );
}
