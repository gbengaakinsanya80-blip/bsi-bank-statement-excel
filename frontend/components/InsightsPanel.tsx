"use client";

import * as React from "react";
import { AlertTriangle, Info, ShieldAlert, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Anomaly, Insight, InsightsReport } from "@/lib/types";
import { cn, formatMoney } from "@/lib/utils";

interface InsightsPanelProps {
  insights?: InsightsReport;
  currency?: string;
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === "positive") return <TrendingUp className="h-4 w-4 text-emerald-600" />;
  if (severity === "warning") return <TrendingDown className="h-4 w-4 text-amber-600" />;
  return <Info className="h-4 w-4 text-primary" />;
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <SeverityIcon severity={insight.severity} />
        {insight.title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{insight.message}</p>
      {insight.detail && (
        <pre className="mt-2 whitespace-pre-line rounded-md bg-muted p-2 font-sans text-[11px] leading-relaxed text-muted-foreground">
          {insight.detail}
        </pre>
      )}
    </div>
  );
}

function ForecastBlock({ insights, currency }: { insights: InsightsReport; currency: string }) {
  const forecast = insights.forecast;
  if (!forecast || forecast.months.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base">Cash-flow forecast</CardTitle>
        <Badge variant="secondary">AI estimate</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">{forecast.summary}</p>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Expected income</th>
                <th className="px-3 py-2 text-right font-medium">Expected expense</th>
                <th className="px-3 py-2 text-right font-medium">Projected balance</th>
              </tr>
            </thead>
            <tbody>
              {forecast.months.map((m) => (
                <tr key={m.month} className="border-t">
                  <td className="px-3 py-2 font-medium">{m.month}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatMoney(m.expected_income, currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                    {formatMoney(m.expected_expense, currency)}
                  </td>
                  <td className={cn("px-3 py-2 text-right font-semibold tabular-nums", m.at_risk && "text-amber-600 dark:text-amber-400")}>
                    {formatMoney(m.projected_balance, currency)}
                    {m.at_risk && (
                      <span className="ml-1 inline-flex items-center gap-0.5 align-middle">
                        <AlertTriangle className="h-3 w-3" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function AnomalyDialog({ anomaly, onClose }: { anomaly: Anomaly | null; onClose: () => void }) {
  return (
    <Dialog open={!!anomaly} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="warning">Flagged</Badge>
            {anomaly?.kind.replaceAll("_", " ")}
          </DialogTitle>
          <DialogDescription>Behavioural pattern worth a second look</DialogDescription>
        </DialogHeader>
        {anomaly && (
          <div className="space-y-3 text-sm">
            <p>{anomaly.message}</p>
            <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 text-xs">
              <span>Page: {anomaly.page_number ?? "—"}</span>
              <span>Line: {anomaly.line_number ?? "—"}</span>
              <span>Amount: {anomaly.amount != null ? formatMoney(anomaly.amount) : "—"}</span>
            </div>
            {anomaly.suggested_action && (
              <div className="rounded-md border border-amber-300/40 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                <p className="mb-1 font-semibold">Suggested action</p>
                {anomaly.suggested_action}
              </div>
            )}
            <Button variant="outline" size="sm" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InsightsPanel({ insights, currency = "NGN" }: InsightsPanelProps) {
  const [openAnomaly, setOpenAnomaly] = React.useState<Anomaly | null>(null);

  if (!insights) return null;
  const hasContent =
    insights.income.length ||
    insights.spending.length ||
    insights.recurring.length ||
    insights.anomalies.length ||
    insights.forecast;

  return (
    <div className="space-y-4">
      {insights.forecast && <ForecastBlock insights={insights} currency={currency} />}

      {hasContent && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="flex items-center gap-1.5 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI Insights
            </CardTitle>
            <Badge variant="secondary">{currency}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.income.length > 0 && (
              <section>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Income</p>
                <div className="space-y-2">
                  {insights.income.map((i, idx) => (
                    <InsightCard key={`income-${idx}`} insight={i} />
                  ))}
                </div>
              </section>
            )}

            {insights.spending.length > 0 && (
              <section>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Spending</p>
                <div className="space-y-2">
                  {insights.spending.map((i, idx) => (
                    <InsightCard key={`spending-${idx}`} insight={i} />
                  ))}
                </div>
              </section>
            )}

            {insights.recurring.length > 0 && (
              <section>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recurring</p>
                <div className="space-y-2">
                  {insights.recurring.map((i, idx) => (
                    <InsightCard key={`recurring-${idx}`} insight={i} />
                  ))}
                </div>
              </section>
            )}

            {insights.anomalies.length > 0 && (
              <section>
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Flags ({insights.anomalies.length})
                </p>
                <ul className="space-y-1.5">
                  {insights.anomalies.map((a, idx) => (
                    <li key={`anomaly-${idx}`}>
                      <button
                        className="w-full rounded-md border border-amber-300/40 bg-amber-50 p-2 text-left text-xs text-amber-900 transition-colors hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-200 dark:hover:bg-amber-900/30"
                        onClick={() => setOpenAnomaly(a)}
                      >
                        <span className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="line-clamp-2">{a.message}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>
      )}

      <AnomalyDialog anomaly={openAnomaly} onClose={() => setOpenAnomaly(null)} />
    </div>
  );
}
