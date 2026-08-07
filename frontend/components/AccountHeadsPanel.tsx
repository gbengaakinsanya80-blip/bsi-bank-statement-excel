"use client";

import { ChartPie, Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AccountHead } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

interface AccountHeadsPanelProps {
  heads: AccountHead[];
  currency: string;
}

function HeadBar({ head, max }: { head: AccountHead; max: number }) {
  const width = max > 0 ? Math.max((head.debit_total + head.credit_total) / max, 0.015) * 100 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
        style={{ width: `${Math.min(width, 100)}%` }}
      />
    </div>
  );
}

export function AccountHeadsPanel({ heads, currency }: AccountHeadsPanelProps) {
  if (!heads.length) return null;
  const max = Math.max(...heads.map((h) => h.debit_total + h.credit_total));
  const totalTx = heads.reduce((sum, h) => sum + h.transaction_count, 0);

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ChartPie className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Account Heads</h3>
              <p className="text-xs text-muted-foreground">
                Every transaction sliced into chart-of-accounts style heads
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            {heads.length} heads · {totalTx.toLocaleString()} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Account Head</th>
                <th className="pb-2 pr-4 text-right font-medium">Tx</th>
                <th className="pb-2 pr-4 text-right font-medium">Debits</th>
                <th className="pb-2 pr-4 text-right font-medium">Credits</th>
                <th className="pb-2 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {heads.map((head) => {
                const net = head.credit_total - head.debit_total;
                return (
                  <tr key={head.name} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{head.name}</span>
                        <span className="w-28 shrink-0">
                          <HeadBar head={head} max={max} />
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground">
                      {head.transaction_count.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-red-600">
                      {head.debit_total ? `-${formatMoney(head.debit_total, currency)}` : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-emerald-600">
                      {head.credit_total ? `+${formatMoney(head.credit_total, currency)}` : "—"}
                    </td>
                    <td
                      className={`py-2.5 text-right font-semibold tabular-nums ${
                        net > 0 ? "text-emerald-600" : net < 0 ? "text-red-600" : "text-muted-foreground"
                      }`}
                    >
                      {net === 0 ? "—" : formatMoney(Math.abs(net), currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
