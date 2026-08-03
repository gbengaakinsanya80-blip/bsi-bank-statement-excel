"use client";

import { ArrowDownRight, ArrowUpRight, Building2, FileText, Scale, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Summary } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

interface SummaryCardsProps {
  summary: Summary;
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-xl font-bold tabular-nums">{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-primary">{icon}</div>
      </CardContent>
    </Card>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const currency = summary.currency ?? "NGN";
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Stat
        label="Opening Balance"
        value={formatMoney(summary.opening_balance, currency)}
        icon={<TrendingUp className="h-5 w-5" />}
      />
      <Stat
        label="Closing Balance"
        value={formatMoney(summary.closing_balance, currency)}
        icon={<Building2 className="h-5 w-5" />}
      />
      <Stat
        label="Total Credits"
        value={formatMoney(summary.total_credits, currency)}
        sub={`${summary.total_credit_count} credit entries`}
        icon={<ArrowUpRight className="h-5 w-5 text-emerald-600" />}
      />
      <Stat
        label="Total Debits"
        value={formatMoney(summary.total_debits, currency)}
        sub={`${summary.total_debit_count} debit entries`}
        icon={<ArrowDownRight className="h-5 w-5 text-red-600" />}
      />
      <Stat label="Transactions" value={summary.number_of_transactions.toLocaleString()} icon={<FileText className="h-5 w-5" />} />
      <Stat
        label="Largest Credit"
        value={formatMoney(summary.largest_credit, currency)}
        icon={<ArrowUpRight className="h-5 w-5 text-emerald-600" />}
      />
      <Stat
        label="Largest Debit"
        value={formatMoney(summary.largest_debit, currency)}
        icon={<ArrowDownRight className="h-5 w-5 text-red-600" />}
      />
      <Stat
        label="Net Cash Flow"
        value={formatMoney(summary.closing_balance !== null && summary.opening_balance !== null
          ? summary.closing_balance - summary.opening_balance
          : null, currency)}
        icon={<Scale className="h-5 w-5" />}
      />
    </div>
  );
}
