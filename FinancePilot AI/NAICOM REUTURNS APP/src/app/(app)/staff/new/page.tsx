import type { Metadata } from "next";
import { StaffForm } from "@/components/masters/staff-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { listStaffCategories } from "@/lib/services/master-data-service";
import { demoStaffCategories } from "@/lib/demo/data";

export const metadata: Metadata = { title: "New staff member" };

export default async function NewStaffPage() {
  const supabase = await createServerSupabase();
  const categories = supabase ? await listStaffCategories(supabase) : demoStaffCategories;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New staff member</h1>
        <p className="text-sm text-muted-foreground">
          Add a permanent staff record — powers the quarterly Personnel Returns.
        </p>
      </div>
      <StaffForm categories={categories} demo={!supabase} />
    </div>
  );
}
