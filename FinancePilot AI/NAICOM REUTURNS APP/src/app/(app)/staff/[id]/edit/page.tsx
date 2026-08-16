import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StaffForm } from "@/components/masters/staff-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { listStaff, listStaffCategories } from "@/lib/services/master-data-service";
import { getDemoStaff } from "@/lib/demo/master-store";
import { demoStaffCategories } from "@/lib/demo/data";

export const metadata: Metadata = { title: "Edit staff member" };

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();

  const staff = supabase
    ? ((await listStaff(supabase)).find((s) => s.id === id) ?? null)
    : await getDemoStaff(id);
  if (!staff) notFound();

  const categories = supabase ? await listStaffCategories(supabase) : demoStaffCategories;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit staff member</h1>
        <p className="text-sm text-muted-foreground">Update the permanent staff master record.</p>
      </div>
      <StaffForm staff={staff} categories={categories} demo={!supabase} />
    </div>
  );
}
