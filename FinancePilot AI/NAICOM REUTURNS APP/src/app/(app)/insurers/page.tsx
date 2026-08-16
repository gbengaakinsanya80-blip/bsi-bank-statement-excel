import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/masters/delete-button";
import { createServerSupabase } from "@/lib/supabase/server";
import { listInsurers } from "@/lib/services/insurer-service";
import { deleteInsurerAction } from "@/lib/services/insurer-actions";
import { listDemoInsurers } from "@/lib/demo/master-store";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Insurers" };

export default async function InsurersPage() {
  const supabase = await createServerSupabase();
  const insurers = supabase ? await listInsurers(supabase) : await listDemoInsurers();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Insurers</h1>
          <p className="text-sm text-muted-foreground">Underwriting companies — used in CRR and Form 1C.</p>
        </div>
        <Link href="/insurers/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" />
          Add insurer
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All insurers ({insurers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insurer</TableHead>
                <TableHead>NAICOM code</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No insurers yet. Click &ldquo;Add insurer&rdquo; to create one.
                  </TableCell>
                </TableRow>
              )}
              {insurers.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.insurer_name}</TableCell>
                  <TableCell>{i.naicom_code ?? "—"}</TableCell>
                  <TableCell>{i.contact ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={i.active ? "success" : "secondary"}>
                      {i.active ? "ACTIVE" : "INACTIVE"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/insurers/${i.id}/edit`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        aria-label={`Edit ${i.insurer_name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <DeleteButton id={i.id} action={deleteInsurerAction} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
