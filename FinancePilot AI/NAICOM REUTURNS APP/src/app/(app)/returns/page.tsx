import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, FileText, Landmark, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenerateForm } from "@/components/returns/generate-form";
import { RETURN_DEFINITIONS } from "@/lib/returns/definitions";
import { createServerSupabase } from "@/lib/supabase/server";
import { listReturnInstances } from "@/lib/returns/return-service";
import { demoReturnSummary, listDemoReturns } from "@/lib/returns/demo-store";
import { formatDate, titleCase } from "@/lib/utils/format";
import { statusVariant } from "@/lib/returns/status";
import type { ReturnInstanceSummary } from "@/lib/returns/types";

export const metadata: Metadata = { title: "Regulatory Returns" };

function definitionIcon(code: string) {
  if (code === "PERSONNEL") return Users;
  if (code === "BUSINESSES_GENERATED") return Landmark;
  return FileText;
}

export default async function ReturnsPage() {
  const supabase = await createServerSupabase();
  const demo = !supabase;

  const instances: ReturnInstanceSummary[] = demo
    ? (await listDemoReturns()).map(demoReturnSummary)
    : await listReturnInstances(supabase);

  const latestByCode = new Map<string, ReturnInstanceSummary>();
  for (const inst of instances) {
    if (!latestByCode.has(inst.code)) latestByCode.set(inst.code, inst);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Regulatory Returns</h1>
        <p className="text-sm text-muted-foreground">
          Generate NAICOM returns from your policy and staff data — enter once, use many times.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {RETURN_DEFINITIONS.map((def) => {
          const Icon = definitionIcon(def.code);
          const latest = latestByCode.get(def.code);
          return (
            <Card key={def.code}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{def.name}</CardTitle>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{def.code}</Badge>
                      <Badge variant="outline">{titleCase(def.frequency)}</Badge>
                      {def.formNumber && <Badge variant="outline">{def.formNumber}</Badge>}
                      <Badge variant="outline">{def.department}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{def.description}</p>
                <GenerateForm code={def.code} frequency={def.frequency} />
                {latest ? (
                  <Link
                    href={`/returns/${latest.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    <CalendarRange className="h-3.5 w-3.5" />
                    Open latest — {latest.periodLabel} ({latest.rowCount} rows)
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Not yet generated for {new Date().getFullYear()}.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated returns ({instances.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Return</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Generated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instances.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No returns generated yet. Pick a period above and press Generate.
                  </TableCell>
                </TableRow>
              )}
              {instances.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell>
                    <Link
                      href={`/returns/${inst.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {inst.name} <span className="text-muted-foreground">· v{inst.versionNo}</span>
                    </Link>
                    <p className="text-xs text-muted-foreground">{inst.code}</p>
                  </TableCell>
                  <TableCell>{inst.periodLabel}</TableCell>
                  <TableCell>{inst.rowCount}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(inst.status)}>{titleCase(inst.status)}</Badge>
                  </TableCell>
                  <TableCell>{formatDate(inst.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
