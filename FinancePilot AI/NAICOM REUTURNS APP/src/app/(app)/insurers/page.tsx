import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import { listInsurers } from "@/lib/services/insurer-service";
import { demoInsurers } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Insurers" };

export default async function InsurersPage() {
  const supabase = await createServerSupabase();
  const insurers = supabase ? await listInsurers(supabase) : demoInsurers;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Insurers</h1>
        <p className="text-sm text-muted-foreground">Underwriting companies — used in CRR and Form 1C.</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {insurers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No insurers yet.
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
