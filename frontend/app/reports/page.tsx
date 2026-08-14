"use client";

import * as React from "react";
import { Download, Loader2, RefreshCw, FileBarChart2, Sheet, Sparkles } from "lucide-react";
import { downloadReportPdf, downloadReportXlsx, getReport, listCompanies, listPeriods, seedDemo } from "@/lib/api";
import type { ReportData } from "@/lib/api";
import type {
  AccountingPeriod, BalanceSheetReport, CashFlowReport, Company,
  IncomeStatementReport, ReportKind,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/utils";

const REPORT_KINDS: { kind: ReportKind; title: string }[] = [
  { kind: "income-statement", title: "Income Statement" },
  { kind: "balance-sheet", title: "Balance Sheet" },
  { kind: "cash-flow", title: "Cash Flow Statement" },
];

export default function ReportsPage() {
  const [companies, setCompanies] = React.useState<Company[] | null>(null);
  const [periods, setPeriods] = React.useState<AccountingPeriod[]>([]);
  const [companyId, setCompanyId] = React.useState<string>("");
  const [periodId, setPeriodId] = React.useState<string>("");
  const [data, setData] = React.useState<Record<ReportKind, ReportData> | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [seeding, setSeeding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadCompanies = React.useCallback(async () => {
    setError(null);
    try {
      const list = await listCompanies();
      setCompanies(list);
      if (list.length > 0 && !list.some((c) => c.id === companyId)) {
        setCompanyId(list[0].id);
      }
    } catch {
      setError("Could not reach the API. Is the backend running?");
    }
  }, [companyId]);

  React.useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  React.useEffect(() => {
    if (!companyId) {
      setPeriods([]);
      setData(null);
      return;
    }
    listPeriods(companyId)
      .then((p) => {
        setPeriods(p);
        setPeriodId("");
      })
      .catch(() => setError("Could not load accounting periods."));
  }, [companyId]);

  const refresh = React.useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [income, balance, cash] = await Promise.all(
        REPORT_KINDS.map(({ kind }) => getReport(companyId, kind, periodId || undefined)),
      );
      setData({
        "income-statement": income,
        "balance-sheet": balance,
        "cash-flow": cash,
      });
    } catch {
      setError("Could not load the reports. Post some journals first.");
    } finally {
      setLoading(false);
    }
  }, [companyId, periodId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const selectedCompany = companies?.find((c) => c.id === companyId);

  const handleSeed = async () => {
    setSeeding(true);
    setError(null);
    try {
      const result = await seedDemo();
      if (result.created) {
        setCompanies([result.company]);
        setCompanyId(result.company.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <main className="container py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FileBarChart2 className="h-6 w-6 text-primary" /> Financial Reports
          </h1>
          <p className="text-sm text-muted-foreground">
            Income statement, balance sheet and cash flow from your posted journals.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading || !companyId}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="w-72 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Company</label>
          <Select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            disabled={!companies || companies.length === 0}
          >
            {!companies ? (
              <option value="">Loading…</option>
            ) : (
              <>
                <option value="">Select a company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </>
            )}
          </Select>
        </div>

        <div className="w-64 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Period</label>
          <Select
            value={periodId}
            onChange={(e) => setPeriodId(e.target.value)}
            disabled={!companyId}
          >
            <option value="">All time</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {!companyId && !loading && (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            {companies && companies.length === 0 ? (
              <div className="flex flex-col items-center gap-3">
                <p>
                  No companies yet. Create a company and post journals before viewing reports —
                  or spin up a demo company with posted journals in one click.
                </p>
                <Button size="sm" onClick={handleSeed} disabled={seeding}>
                  {seeding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Seeding…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Create demo data
                    </>
                  )}
                </Button>
              </div>
            ) : (
              "Select a company to view its financial statements."
            )}
          </CardContent>
        </Card>
      )}

      {!data && loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
        </div>
      )}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2">
          <IncomeCard
            data={data["income-statement"] as IncomeStatementReport}
            company={selectedCompany}
            onPdf={() => downloadReportPdf(companyId, "income-statement", periodId || undefined)}
            onXlsx={() => downloadReportXlsx(companyId, "income-statement", periodId || undefined)}
          />
          <BalanceCard
            data={data["balance-sheet"] as BalanceSheetReport}
            company={selectedCompany}
            onPdf={() => downloadReportPdf(companyId, "balance-sheet", periodId || undefined)}
            onXlsx={() => downloadReportXlsx(companyId, "balance-sheet", periodId || undefined)}
          />
          <CashFlowCard
            data={data["cash-flow"] as CashFlowReport}
            company={selectedCompany}
            onPdf={() => downloadReportPdf(companyId, "cash-flow", periodId || undefined)}
            onXlsx={() => downloadReportXlsx(companyId, "cash-flow", periodId || undefined)}
          />
        </div>
      )}
    </main>
  );
}

// ------------------------------------------------------------------ //
// Shared bits
// ------------------------------------------------------------------ //
function ReportShell({
  title, period, onPdf, onXlsx, children,
}: {
  title: string;
  period: string | null;
  onPdf: () => void;
  onXlsx: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle>{title}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {period ? `Period: ${period}` : "Period: All time (entire ledger)"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPdf}>
            <Download className="h-4 w-4" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={onXlsx}>
            <Sheet className="h-4 w-4" /> Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MoneyCell({ value, bold = false }: { value: number; bold?: boolean }) {
  return (
    <TableCell className={`text-right tabular-nums ${bold ? "font-semibold" : ""}`}>
      {formatMoney(value)}
    </TableCell>
  );
}

// ------------------------------------------------------------------ //
// Income statement
// ------------------------------------------------------------------ //
function IncomeCard({
  data, company, onPdf, onXlsx,
}: {
  data: IncomeStatementReport;
  company?: Company;
  onPdf: () => void;
  onXlsx: () => void;
}) {
  const currency = company?.currency ?? "NGN";
  return (
    <ReportShell title="Income Statement" period={data.period_id} onPdf={onPdf} onXlsx={onXlsx}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">Revenue</TableCell>
            <TableCell />
          </TableRow>
          {data.revenue.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                {item.code} — {item.name}
              </TableCell>
              <MoneyCell value={item.balance} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-semibold">Total Revenue</TableCell>
            <MoneyCell value={data.total_revenue} bold />
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Expenses</TableCell>
            <TableCell />
          </TableRow>
          {data.expenses.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                {item.code} — {item.name}
              </TableCell>
              <MoneyCell value={item.balance} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-semibold">Total Expenses</TableCell>
            <MoneyCell value={data.total_expenses} bold />
          </TableRow>
          <TableRow className="border-t-2">
            <TableCell className="font-bold">Net Profit</TableCell>
            <MoneyCell value={data.net_profit} bold />
          </TableRow>
        </TableBody>
      </Table>
      <p className="mt-3 text-xs text-muted-foreground">
        All amounts in {currency}.
      </p>
    </ReportShell>
  );
}

// ------------------------------------------------------------------ //
// Balance sheet
// ------------------------------------------------------------------ //
function BalanceCard({
  data, company, onPdf, onXlsx,
}: {
  data: BalanceSheetReport;
  company?: Company;
  onPdf: () => void;
  onXlsx: () => void;
}) {
  const currency = company?.currency ?? "NGN";
  return (
    <ReportShell title="Balance Sheet" period={data.period_id} onPdf={onPdf} onXlsx={onXlsx}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">Assets</TableCell>
            <TableCell />
          </TableRow>
          {data.assets.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                {item.code} — {item.name}
              </TableCell>
              <MoneyCell value={item.balance} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-semibold">Total Assets</TableCell>
            <MoneyCell value={data.total_assets} bold />
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Liabilities</TableCell>
            <TableCell />
          </TableRow>
          {data.liabilities.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                {item.code} — {item.name}
              </TableCell>
              <MoneyCell value={item.balance} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="font-semibold">Total Liabilities</TableCell>
            <MoneyCell value={data.total_liabilities} bold />
          </TableRow>
          <TableRow>
            <TableCell className="font-semibold">Equity</TableCell>
            <TableCell />
          </TableRow>
          {data.equity.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                {item.code} — {item.name}
              </TableCell>
              <MoneyCell value={item.balance} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="pl-6 text-muted-foreground">Current Year Profit</TableCell>
            <MoneyCell value={data.current_year_profit} />
          </TableRow>
          {data.balancing_figure !== 0 && (
            <TableRow>
              <TableCell className="pl-6 text-muted-foreground">Balancing Figure</TableCell>
              <MoneyCell value={data.balancing_figure} />
            </TableRow>
          )}
          <TableRow className="border-t-2">
            <TableCell className="font-bold">Total Equity</TableCell>
            <MoneyCell value={data.total_equity} bold />
          </TableRow>
        </TableBody>
      </Table>
      <div className="mt-3 flex items-center gap-2">
        <Badge variant={data.balanced ? "success" : "destructive"}>
          {data.balanced ? "Balanced" : "Out of balance"}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Assets = Liabilities + Equity ({formatMoney(data.total_liabilities + data.total_equity, currency)})
        </p>
      </div>
    </ReportShell>
  );
}

// ------------------------------------------------------------------ //
// Cash flow
// ------------------------------------------------------------------ //
function CashFlowCard({
  data, company, onPdf, onXlsx,
}: {
  data: CashFlowReport;
  company?: Company;
  onPdf: () => void;
  onXlsx: () => void;
}) {
  const currency = company?.currency ?? "NGN";
  return (
    <ReportShell title="Cash Flow Statement (indirect)" period={data.period_id} onPdf={onPdf} onXlsx={onXlsx}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Line item</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-semibold">Operating Activities</TableCell>
            <TableCell />
          </TableRow>
          <TableRow>
            <TableCell className="pl-6 text-muted-foreground">Net Profit</TableCell>
            <MoneyCell value={data.operating.net_profit} />
          </TableRow>
          {data.operating.adjustments.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                Adjustment — {item.code} {item.name}
              </TableCell>
              <MoneyCell value={item.change} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="pl-6 font-semibold">Net Cash from Operating Activities</TableCell>
            <MoneyCell value={data.operating.net_cash} bold />
          </TableRow>

          <TableRow>
            <TableCell className="font-semibold">Investing Activities</TableCell>
            <TableCell />
          </TableRow>
          {data.investing.items.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                {item.code} {item.name}
              </TableCell>
              <MoneyCell value={item.change} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="pl-6 font-semibold">Net Cash from Investing Activities</TableCell>
            <MoneyCell value={data.investing.net_cash} bold />
          </TableRow>

          <TableRow>
            <TableCell className="font-semibold">Financing Activities</TableCell>
            <TableCell />
          </TableRow>
          {data.financing.items.map((item) => (
            <TableRow key={item.code}>
              <TableCell className="pl-6 text-muted-foreground">
                {item.code} {item.name}
              </TableCell>
              <MoneyCell value={item.change} />
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="pl-6 font-semibold">Net Cash from Financing Activities</TableCell>
            <MoneyCell value={data.financing.net_cash} bold />
          </TableRow>

          <TableRow>
            <TableCell className="font-semibold">Net Increase in Cash</TableCell>
            <MoneyCell value={data.net_increase_in_cash} />
          </TableRow>
          <TableRow className="border-t-2">
            <TableCell className="font-bold">Closing Cash</TableCell>
            <MoneyCell value={data.closing_cash} bold />
          </TableRow>
        </TableBody>
      </Table>
      <div className="mt-3 flex items-center gap-2">
        <Badge variant={data.ties_to_cash ? "success" : "destructive"}>
          {data.ties_to_cash ? "Reconciled" : "Does not reconcile"}
        </Badge>
        <p className="text-xs text-muted-foreground">
          Operating + Investing + Financing reconciles to the {currency} bank movement.
        </p>
      </div>
    </ReportShell>
  );
}
