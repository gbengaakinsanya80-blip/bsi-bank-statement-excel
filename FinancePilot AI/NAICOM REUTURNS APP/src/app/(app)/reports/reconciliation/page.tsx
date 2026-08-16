import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, ExternalLink, Scale } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createServerSupabase } from "@/lib/supabase/server";
import { listDemoReturns } from "@/lib/returns/demo-store";
import { demoPolicySources } from "@/lib/demo/policy-sources";
import {
  runReconciliation,
  type ReconcileResult,
  type ReconciliationInput,
  type ReconciliationReturnLike,
} from "@/lib/compliance/reconciliation";
import type { PolicySource } from "@/lib/returns/types";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Reconciliation" };

function statusBadge(status: ReconcileResult["status"]) {
  if (status === "OK") return <Badge variant="success">OK</Badge>;
  if (status === "WARNING") return <Badge variant="warning">Reconciliation warning</Badge>;
  return <Badge variant="secondary">Not applicable</Badge>;
}

function ResultCard({ result }: { result: ReconcileResult }) {
  const showValues = result.valueA !== null && result.valueB !== null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{result.name}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.code === "commission" || result.code === "premium" || result.code === "form1c" ? (
              "Compares two returns generated from the same underlying data."
            ) : result.code === "rate" ? (
              "Compares stored commission against the approved rate applied to gross premium."
            ) : (
              "Compares transactional records against policy totals."
            )}
          </p>
        </div>
        {statusBadge(result.status)}
      </CardHeader>
      <CardContent className="space-y-3">
        {showValues && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/40 p-2.5">
              <p className="text-xs text-muted-foreground">Source A</p>
              <p className="text-sm font-semibold">{formatMoney(result.valueA!)}</p>
            </div>
            <div className="rounded-md border bg-muted/40 p-2.5">
              <p className="text-xs text-muted-foreground">Source B</p>
              <p className="text-sm font-semibold">{formatMoney(result.valueB!)}</p>
            </div>
            <div className={cn("rounded-md border p-2.5", result.status === "WARNING" ? "border-warning/40 bg-warning/5" : "bg-muted/40")}>
              <p className="text-xs text-muted-foreground">Difference</p>
              <p className={cn("text-sm font-semibold", result.status === "WARNING" && "text-warning")}>
                {formatMoney(result.difference!)}
              </p>
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">{result.message}</p>

        {(result.linkA || result.linkB) && (
          <div className="flex flex-wrap gap-2 text-sm">
            {result.linkA && (
              <Link href={`/returns/${result.linkA}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" />
                Open source A return
              </Link>
            )}
            {result.linkB && (
              <Link href={`/returns/${result.linkB}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                <ExternalLink className="h-3.5 w-3.5" />
                Open source B return
              </Link>
            )}
          </div>
        )}

        {result.drilldown.length > 0 && (
          <details className="group">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary hover:underline">
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
              Drill-down ({result.drilldown.length} contributing items)
            </summary>
            <div className="mt-2 overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Policy / item</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {result.drilldown.map((row, i) => (
                    <tr key={i} className="border-t">
                      <td className="px-3 py-2">
                        {row.policyNo && (
                          <span className="mr-1.5 inline-block rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                            {row.policyNo}
                          </span>
                        )}
                        {row.label}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(row.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ReconciliationPage() {
  const supabase = await createServerSupabase();
  const demo = !supabase;

  let input: ReconciliationInput;
  if (demo) {
    const demoReturns = await listDemoReturns();
    const returns: ReconciliationReturnLike[] = demoReturns.map((r) => ({
      id: r.id,
      code: r.code,
      periodKey: r.period.key,
      periodStart: r.period.start,
      periodEnd: r.period.end,
      status: r.status,
      rows: r.rows,
    }));
    input = { returns, policies: await demoPolicySources() };
  } else {
    const { data: returns } = await supabase
      .from("returns")
      .select(`id, period_start, period_end, period_label, status, return_definitions(code)`);
    const { data: lines } = await supabase.from("return_line_items").select("return_id, row_data");
    const rowsByReturn = new Map<string, Record<string, unknown>[]>();
    for (const line of lines ?? []) {
      const list = rowsByReturn.get(line.return_id) ?? [];
      list.push((line.row_data as Record<string, unknown>) ?? {});
      rowsByReturn.set(line.return_id, list);
    }
    const returnsLike: ReconciliationReturnLike[] = (returns ?? []).map((r) => ({
      id: r.id,
      code: (r.return_definitions as unknown as { code?: string })?.code ?? "INCOME_PRODUCTION",
      periodKey: `${r.period_start}_to_${r.period_end}`,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      status: r.status,
      rows: rowsByReturn.get(r.id) ?? [],
    }));
    const { data: policyRows } = await supabase
      .from("policies")
      .select(
        "id, policy_number, insured_name, transaction_date, gross_premium, brokerage_commission, commission_rate, premium_collected, premium_paid_to_insurer"
      )
      .is("deleted_at", null);
    const policies: PolicySource[] = (policyRows ?? []).map((p) => ({
      id: p.id,
      transaction_reference: null,
      policy_number: p.policy_number,
      endorsement_number: null,
      transaction_type: "NEW",
      risk_type: null,
      class_of_business: null,
      insured_name: p.insured_name,
      client_name: null,
      insurer_name: null,
      broker_or_agent: null,
      ledger_account: null,
      sum_insured: null,
      currency: "NGN",
      gross_premium: p.gross_premium ? Number(p.gross_premium) : null,
      premium_collected: p.premium_collected ? Number(p.premium_collected) : null,
      premium_paid_to_insurer: p.premium_paid_to_insurer ? Number(p.premium_paid_to_insurer) : null,
      brokerage_commission: p.brokerage_commission ? Number(p.brokerage_commission) : null,
      commission_rate: p.commission_rate ? Number(p.commission_rate) : null,
      tax: null,
      other_deductions: null,
      net_premium: null,
      amount_received: null,
      receipt_number: null,
      debit_note_number: null,
      credit_note_number: null,
      transaction_date: p.transaction_date,
      cover_from: null,
      cover_to: null,
      premium_collection_date: null,
      premium_payment_date: null,
      branch_location: null,
      remarks: null,
      bank_name: null,
      cheque_number: null,
    }));
    input = { returns: returnsLike, policies };
  }

  const results = runReconciliation(input);
  const okCount = results.filter((r) => r.status === "OK").length;
  const warningCount = results.filter((r) => r.status === "WARNING").length;
  const naCount = results.filter((r) => r.status === "N/A").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Scale className="h-6 w-6" />
          Reconciliation
        </h1>
        <p className="text-sm text-muted-foreground">
          Cross-return and policy-level checks that flag differences outside tolerance. Click a
          warning to drill down into the contributing items.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-success">{okCount}</p>
            <p className="text-xs text-muted-foreground">Reconciled (OK)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold text-warning">{warningCount}</p>
            <p className="text-xs text-muted-foreground">Reconciliation warnings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{naCount}</p>
            <p className="text-xs text-muted-foreground">Not applicable</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {results.map((result) => (
          <ResultCard key={result.ruleId} result={result} />
        ))}
      </div>
    </div>
  );
}
