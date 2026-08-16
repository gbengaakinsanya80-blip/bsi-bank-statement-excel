import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/masters/delete-button";
import { createServerSupabase } from "@/lib/supabase/server";
import { listStaff } from "@/lib/services/master-data-service";
import { deleteStaffAction } from "@/lib/services/staff-actions";
import { listDemoStaff } from "@/lib/demo/master-store";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const supabase = await createServerSupabase();
  const staff = supabase ? await listStaff(supabase) : await listDemoStaff();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-sm text-muted-foreground">
            Permanent Staff Master — powers the quarterly Personnel Returns.
          </p>
        </div>
        <Link href="/staff/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" />
          Add staff member
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All staff ({staff.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Employment date</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No staff records yet. Click &ldquo;Add staff member&rdquo; to create one.
                  </TableCell>
                </TableRow>
              )}
              {staff.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.staff_name}</TableCell>
                  <TableCell>{s.staff_categories?.name ?? "—"}</TableCell>
                  <TableCell>{s.designation ?? "—"}</TableCell>
                  <TableCell>{s.gender ?? "—"}</TableCell>
                  <TableCell>{formatDate(s.date_of_employment)}</TableCell>
                  <TableCell>{s.location ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/staff/${s.id}/edit`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        aria-label={`Edit ${s.staff_name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <DeleteButton id={s.id} action={deleteStaffAction} />
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
