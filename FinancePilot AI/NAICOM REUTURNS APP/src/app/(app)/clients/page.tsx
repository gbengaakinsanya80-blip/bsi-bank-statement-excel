import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/masters/delete-button";
import { createServerSupabase } from "@/lib/supabase/server";
import { listClients } from "@/lib/services/client-service";
import { deleteClientAction } from "@/lib/services/client-actions";
import { listDemoClients } from "@/lib/demo/master-store";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Clients" };

const statusVariant: Record<string, "default" | "success" | "destructive" | "secondary"> = {
  ACTIVE: "success",
  INACTIVE: "secondary",
  SUSPENDED: "destructive",
};

export default async function ClientsPage() {
  const supabase = await createServerSupabase();
  const clients = supabase ? await listClients(supabase) : await listDemoClients();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-sm text-muted-foreground">Client master — customer records used across returns.</p>
        </div>
        <Link href="/clients/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" />
          Add client
        </Link>
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
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No clients yet. Click &ldquo;Add client&rdquo; to create one.
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
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/clients/${c.id}/edit`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        aria-label={`Edit ${c.client_name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <DeleteButton id={c.id} action={deleteClientAction} />
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
