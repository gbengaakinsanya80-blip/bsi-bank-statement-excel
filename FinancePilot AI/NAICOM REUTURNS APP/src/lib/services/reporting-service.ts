import type { DbClient } from "@/lib/supabase/server";
import { demoPolicySources } from "@/lib/demo/policy-sources";

export interface ReportRow {
  id: string;
  policy_number: string | null;
  insured_name: string | null;
  client_name: string | null;
  insurer_name: string | null;
  risk_type: string | null;
  class_of_business: string | null;
  currency: string;
  transaction_date: string | null;
  gross_premium: number;
  premium_collected: number;
  premium_paid_to_insurer: number;
  brokerage_commission: number;
}

export interface ReportFilters {
  from?: string;
  to?: string;
  client?: string;
  insurer?: string;
  risk?: string;
  currency?: string;
}

export interface MonthlyPoint {
  month: string;
  label: string;
  gross_premium: number;
  premium_collected: number;
  premium_paid_to_insurer: number;
  outstanding: number;
  brokerage_commission: number;
  count: number;
}

export interface GroupedPoint {
  name: string;
  count: number;
  gross_premium: number;
  premium_collected: number;
  premium_paid_to_insurer: number;
  outstanding: number;
  brokerage_commission: number;
}

export interface ReportTotals {
  count: number;
  gross_premium: number;
  premium_collected: number;
  premium_paid_to_insurer: number;
  outstanding: number;
  brokerage_commission: number;
}

const num = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export async function fetchReportRows(supabase: DbClient | null): Promise<ReportRow[]> {
  if (!supabase) {
    const sources = await demoPolicySources();
    return sources.map((p) => ({
      id: p.id,
      policy_number: p.policy_number,
      insured_name: p.insured_name,
      client_name: p.client_name,
      insurer_name: p.insurer_name,
      risk_type: p.risk_type ?? p.class_of_business,
      class_of_business: p.class_of_business,
      currency: p.currency,
      transaction_date: p.transaction_date,
      gross_premium: num(p.gross_premium),
      premium_collected: num(p.premium_collected),
      premium_paid_to_insurer: num(p.premium_paid_to_insurer),
      brokerage_commission: num(p.brokerage_commission),
    }));
  }

  const { data, error } = await supabase
    .from("policies")
    .select(
      `id,
      policy_number,
      insured_name,
      risk_type,
      class_of_business,
      currency,
      transaction_date,
      gross_premium,
      premium_collected,
      premium_paid_to_insurer,
      brokerage_commission,
      clients(client_name),
      insurers(insurer_name)`
    )
    .is("deleted_at", null)
    .eq("is_demo", false);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown[]).map((row) => {
    const r = row as Record<string, unknown> & {
      clients?: { client_name: string } | null;
      insurers?: { insurer_name: string } | null;
    };
    return {
      id: String(r.id),
      policy_number: r.policy_number as string | null,
      insured_name: r.insured_name as string | null,
      client_name: r.clients?.client_name ?? null,
      insurer_name: r.insurers?.insurer_name ?? null,
      risk_type: (r.risk_type as string | null) ?? (r.class_of_business as string | null),
      class_of_business: r.class_of_business as string | null,
      currency: String(r.currency ?? "NGN"),
      transaction_date: r.transaction_date as string | null,
      gross_premium: num(r.gross_premium as string | number | null),
      premium_collected: num(r.premium_collected as string | number | null),
      premium_paid_to_insurer: num(r.premium_paid_to_insurer as string | number | null),
      brokerage_commission: num(r.brokerage_commission as string | number | null),
    };
  });
}

export function applyReportFilters(rows: ReportRow[], filters: ReportFilters): ReportRow[] {
  const from = filters.from ? new Date(`${filters.from}T00:00:00Z`).getTime() : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59Z`).getTime() : null;
  const client = filters.client?.trim().toLowerCase();
  const insurer = filters.insurer?.trim().toLowerCase();
  const risk = filters.risk?.trim().toLowerCase();
  const currency = filters.currency?.trim().toUpperCase();

  return rows.filter((r) => {
    if (from || to) {
      const t = r.transaction_date ? new Date(`${r.transaction_date}T00:00:00Z`).getTime() : null;
      if (t === null) return false;
      if (from && t < from) return false;
      if (to && t > to) return false;
    }
    if (client && !(r.client_name ?? "").toLowerCase().includes(client)) return false;
    if (insurer && !(r.insurer_name ?? "").toLowerCase().includes(insurer)) return false;
    if (risk && !(r.risk_type ?? "").toLowerCase().includes(risk)) return false;
    if (currency && r.currency.toUpperCase() !== currency) return false;
    return true;
  });
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  const m = Number(month) - 1;
  return `${MONTH_LABELS[m] ?? month} ${year}`;
}

export function monthlyTrend(rows: ReportRow[]): MonthlyPoint[] {
  const byMonth = new Map<string, MonthlyPoint>();
  for (const r of rows) {
    if (!r.transaction_date) continue;
    const key = r.transaction_date.slice(0, 7);
    let point = byMonth.get(key);
    if (!point) {
      point = {
        month: key,
        label: monthLabel(key),
        gross_premium: 0,
        premium_collected: 0,
        premium_paid_to_insurer: 0,
        outstanding: 0,
        brokerage_commission: 0,
        count: 0,
      };
      byMonth.set(key, point);
    }
    point.gross_premium += r.gross_premium;
    point.premium_collected += r.premium_collected;
    point.premium_paid_to_insurer += r.premium_paid_to_insurer;
    point.brokerage_commission += r.brokerage_commission;
    point.count += 1;
  }
  return [...byMonth.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((p) => ({ ...p, outstanding: Math.max(p.premium_collected - p.premium_paid_to_insurer, 0) }));
}

type GroupKey = "client_name" | "insurer_name" | "risk_type";

export function groupBy(rows: ReportRow[], key: GroupKey): GroupedPoint[] {
  const byKey = new Map<string, GroupedPoint>();
  for (const r of rows) {
    const raw = key === "risk_type" ? (r.risk_type ?? r.class_of_business) : r[key];
    const name = (raw ?? "Unclassified").trim() || "Unclassified";
    let point = byKey.get(name);
    if (!point) {
      point = {
        name,
        count: 0,
        gross_premium: 0,
        premium_collected: 0,
        premium_paid_to_insurer: 0,
        outstanding: 0,
        brokerage_commission: 0,
      };
      byKey.set(name, point);
    }
    point.count += 1;
    point.gross_premium += r.gross_premium;
    point.premium_collected += r.premium_collected;
    point.premium_paid_to_insurer += r.premium_paid_to_insurer;
    point.brokerage_commission += r.brokerage_commission;
  }
  return [...byKey.values()]
    .sort((a, b) => b.gross_premium - a.gross_premium)
    .map((p) => ({ ...p, outstanding: Math.max(p.premium_collected - p.premium_paid_to_insurer, 0) }));
}

export function reportTotals(rows: ReportRow[]): ReportTotals {
  let count = 0;
  let gross_premium = 0;
  let premium_collected = 0;
  let premium_paid_to_insurer = 0;
  let brokerage_commission = 0;
  for (const r of rows) {
    count += 1;
    gross_premium += r.gross_premium;
    premium_collected += r.premium_collected;
    premium_paid_to_insurer += r.premium_paid_to_insurer;
    brokerage_commission += r.brokerage_commission;
  }
  return {
    count,
    gross_premium,
    premium_collected,
    premium_paid_to_insurer,
    outstanding: Math.max(premium_collected - premium_paid_to_insurer, 0),
    brokerage_commission,
  };
}

export function parseReportFilters(searchParams: URLSearchParams): ReportFilters {
  return {
    from: searchParams.get("from")?.slice(0, 10) || undefined,
    to: searchParams.get("to")?.slice(0, 10) || undefined,
    client: searchParams.get("client") || undefined,
    insurer: searchParams.get("insurer") || undefined,
    risk: searchParams.get("risk") || undefined,
    currency: searchParams.get("currency") || undefined,
  };
}

export function distinctValues(rows: ReportRow[], key: "client_name" | "insurer_name" | "risk_type" | "currency"): string[] {
  const seen = new Set<string>();
  for (const r of rows) {
    const v = key === "currency" ? r.currency : r[key];
    if (v) seen.add(v);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
