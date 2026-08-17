import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import { listAudit } from "@/lib/services/audit-service";
import { formatDateTime } from "@/lib/utils/format";
import { requireAppUser } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Audit Trail" };

export default async function AuditPage() {
  await requireAppUser();
  const supabase = await createServerSupabase();
  const entries = await listAudit(supabase, 200);

  const modules = [...new Set(entries.map((e) => e.module))].sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <ScrollText className="h-6 w-6" />
            Audit Trail
          </h1>
          <p className="text-sm text-muted-foreground">
            Immutable record of board actions and system events.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>User</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No audit events recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-xs">{formatDateTime(e.created_at)}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                      {e.module.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{e.action.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.record_id ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.user_id ?? "system"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {modules.length > 1 && (
            <p className="px-4 pb-3 text-xs text-muted-foreground">
              Modules: {modules.map((m) => m.replace(/_/g, " ")).join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
