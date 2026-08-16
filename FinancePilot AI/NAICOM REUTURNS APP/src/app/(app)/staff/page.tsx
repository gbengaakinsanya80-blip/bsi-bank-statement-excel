import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createServerSupabase } from "@/lib/supabase/server";
import { listStaff } from "@/lib/services/master-data-service";
import { demoStaffForTable } from "@/lib/demo/data";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const supabase = await createServerSupabase();
  const staff = supabase ? await listStaff(supabase) : demoStaffForTable();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Staff</h1>
        <p className="text-sm text-muted-foreground">
          Permanent Staff Master — powers the quarterly Personnel Returns.
        </p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No staff records yet.
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
