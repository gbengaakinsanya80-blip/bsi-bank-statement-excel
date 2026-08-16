"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMoney, formatNumber } from "@/lib/utils/format";
import type { GroupedPoint, MonthlyPoint } from "@/lib/services/reporting-service";

function moneyTooltip(value: string | number | readonly (string | number)[] | undefined) {
  const n = Array.isArray(value) ? Number(value[0] ?? 0) : Number(value ?? 0);
  return formatMoney(Number.isFinite(n) ? n : 0, "NGN");
}

export function MonthlyTrendChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}m` : formatNumber(v))}
          />
          <Tooltip formatter={moneyTooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Area type="monotone" dataKey="gross_premium" name="Gross premium" stackId="1" fill="hsl(var(--chart-1))" fillOpacity={0.25} stroke="hsl(var(--chart-1))" />
          <Area type="monotone" dataKey="premium_collected" name="Collected" stackId="1" fill="hsl(var(--chart-2))" fillOpacity={0.25} stroke="hsl(var(--chart-2))" />
          <Line type="monotone" dataKey="premium_paid_to_insurer" name="Paid to insurer" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="brokerage_commission" name="Commission" stroke="hsl(var(--chart-4))" strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GroupedBarChart({
  data,
  valueLabel = "Gross premium",
  currency,
}: {
  data: GroupedPoint[];
  valueLabel?: string;
  currency?: string;
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}m` : formatNumber(v))}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={150}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip formatter={(value) => formatMoney(Number(value ?? 0), currency ?? "NGN")} />
          <Bar dataKey="gross_premium" name={valueLabel} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
