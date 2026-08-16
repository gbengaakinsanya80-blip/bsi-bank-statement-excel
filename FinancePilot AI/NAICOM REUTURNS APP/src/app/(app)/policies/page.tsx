import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Plus } from "lucide-react";
import { createServerSupabase } from "@/lib/supabase/server";
import { listPolicies } from "@/lib/services/policy-service";
import { demoPoliciesForTable } from "@/lib/demo/data";
import { formatDate, formatMoney, titleCase } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const supabase = await createServerSupabase();
  const demo = !supabase;

  const policies = demo ? await demoPoliciesForTable() : await listPolicies(supabase, 200);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Master business/policy database — feeds every NAICOM return.
          </p>
        </div>
        <Link
          href="/policies/new"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New policy
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All policies ({policies.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Policy No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Gross premium</TableHead>
                <TableHead>Commission</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No policies yet.{" "}
                    <Link href="/policies/new" className="text-primary hover:underline">
                      Add your first policy
                    </Link>
                    .
                  </TableCell>
                </TableRow>
              )}
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.policy_number ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{titleCase(p.transaction_type)}</Badge>
                  </TableCell>
                  <TableCell>{p.clients?.client_name ?? p.insured_name ?? "—"}</TableCell>
                  <TableCell>{p.insurers?.insurer_name ?? "—"}</TableCell>
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
