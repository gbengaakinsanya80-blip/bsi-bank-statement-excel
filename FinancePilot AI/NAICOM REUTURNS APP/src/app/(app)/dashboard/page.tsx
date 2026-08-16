import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, FileText, Landmark, ShieldCheck, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import { getDashboardKpis, getRecentPolicies } from "@/lib/services/dashboard-service";
import { demoKpis, demoRecentPolicies } from "@/lib/demo/data";
import { formatDate, formatMoney, titleCase } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = await createServerSupabase();
  const demo = !supabase;

  const [kpis, recent] = demo
    ? [demoKpis, demoRecentPolicies]
    : await Promise.all([
        getDashboardKpis(supabase),
        getRecentPolicies(supabase, 8),
      ]);

  const cards = [
    {
      label: "Policies (active)",
      value: String(kpis.active_policies_count),
      sub: `${kpis.policies_this_month} added this month`,
      icon: FileText,
    },
    {
      label: "Gross premium",
      value: formatMoney(kpis.gross_premium_total, "NGN"),
      sub: "All-time, NGN",
      icon: Landmark,
    },
    {
      label: "Premium collected",
      value: formatMoney(kpis.premium_collected_total, "NGN"),
      sub: `${Math.round((kpis.premium_collected_total / Math.max(kpis.gross_premium_total, 1)) * 100)}% of gross`,
      icon: ArrowUpRight,
    },
    {
      label: "Commission",
      value: formatMoney(kpis.commission_total, "NGN"),
      sub: "Brokerage earned",
      icon: ShieldCheck,
    },
    {
      label: "Clients",
      value: String(kpis.clients_count),
      sub: "Active client masters",
      icon: Building2,
    },
    {
      label: "Insurers",
      value: String(kpis.insurers_count),
      sub: "Active insurer masters",
      icon: Landmark,
    },
    {
      label: "Staff",
      value: String(kpis.staff_count),
      sub: "Staff master records",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            WORLDMARK INSURANCE BROKERS LTD — business statistics
          </p>
        </div>
        <Link
          href="/policies/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <FileText className="h-4 w-4" />
          Add policy
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent policies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Insured / Client</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Gross premium</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No policies yet. Add your first policy to get started.
                  </TableCell>
                </TableRow>
              )}
              {recent.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.policy_number ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{titleCase(p.transaction_type)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="leading-tight">
                      <p>{p.insured_name ?? "—"}</p>
                      {p.client_name && (
                        <p className="text-xs text-muted-foreground">{p.client_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{p.risk_type ?? "—"}</TableCell>
                  <TableCell>{formatMoney(p.gross_premium, p.currency)}</TableCell>
                  <TableCell>{formatMoney(p.brokerage_commission, p.currency)}</TableCell>
                  <TableCell>{formatDate(p.transaction_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
