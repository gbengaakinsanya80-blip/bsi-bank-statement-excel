import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createServerSupabase } from "@/lib/supabase/server";
import { listDemoTrainingRecords } from "@/lib/demo/training-store";
import { deleteTrainingAction } from "@/lib/services/training-actions";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import { DeleteButton } from "@/components/masters/delete-button";

export const metadata: Metadata = { title: "Training Records" };

const STATUS_BADGE: Record<string, string> = {
  COMPLETED: "bg-emerald-100 text-emerald-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  CANCELLED: "bg-red-100 text-red-800",
};

async function listRecords() {
  const supabase = await createServerSupabase();
  if (supabase) {
    const { data } = await supabase
      .from("training_records")
      .select("*")
      .is("deleted_at", null)
      .order("training_date", { ascending: false });
    return data ?? [];
  }
  return listDemoTrainingRecords();
}

export default async function TrainingPage() {
  const records = await listRecords();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Training Records</h1>
          <p className="text-sm text-muted-foreground">
            Track staff training programmes, certifications, and professional development.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/api/training/export"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            target="_blank"
          >
            <Download className="mr-1 h-4 w-4" />
            Export PDF
          </Link>
          <Link href="/training/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="h-4 w-4" />
            Add training record
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All records ({records.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>S/N</TableHead>
                <TableHead>Staff Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Training Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cert</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center text-muted-foreground">
                    No training records yet. Click &ldquo;Add training record&rdquo; to create one.
                  </TableCell>
                </TableRow>
              )}
              {records.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-medium">{r.staff_name}</TableCell>
                  <TableCell>{r.position ?? "—"}</TableCell>
                  <TableCell>{r.training_title}</TableCell>
                  <TableCell>{r.training_type ?? "—"}</TableCell>
                  <TableCell>{r.organizer}</TableCell>
                  <TableCell>{formatDate(r.training_date)}</TableCell>
                  <TableCell>{r.duration_hours != null ? `${r.duration_hours}h` : "—"}</TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium", STATUS_BADGE[r.status] ?? "bg-gray-100 text-gray-800")}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell>{r.certificate_available ? "Yes" : "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/training/${r.id}/edit`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        aria-label={`Edit ${r.training_title}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <DeleteButton id={r.id} action={deleteTrainingAction} />
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
