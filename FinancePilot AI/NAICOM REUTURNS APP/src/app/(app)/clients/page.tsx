import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import { listClients } from "@/lib/services/client-service";
import { demoClients } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Clients" };

const statusVariant: Record<string, "default" | "success" | "destructive" | "secondary"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
};

export default async function ClientsPage() {
  const supabase = await createServerSupabase();
  const clients = supabase ? await listClients(supabase) : demoClients;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clients</h1>
        <p className="text-sm text-muted-foreground">Client master — customer records used across returns.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All clients ({clients.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Contact person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No clients yet.
                  </TableCell>
                </TableRow>
              )}
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.client_name}</TableCell>
                  <TableCell>{c.industry ?? "—"}</TableCell>
                  <TableCell>{c.contact_person ?? "—"}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[c.status] ?? "secondary"}>{c.status}</Badge>
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
