"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createStaffAction,
  updateStaffAction,
  type StaffActionState,
} from "@/lib/services/staff-actions";
import type { Staff, StaffCategory } from "@/lib/types/database";

const initialState: StaffActionState = null;

export function StaffForm({
  staff,
  categories,
  demo = false,
}: {
  staff?: Staff | null;
  categories: StaffCategory[];
  demo?: boolean;
}) {
  const isEdit = Boolean(staff);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateStaffAction : createStaffAction,
    initialState
  );
  const router = useRouter();
  const s = staff ?? null;

  return (
    <form action={formAction} className="space-y-6">
      {demo && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold text-foreground">Preview mode.</strong> Staff records
            you save are stored locally for this session and feed the Personnel Returns.
          </span>
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {isEdit && <input type="hidden" name="id" value={s!.id} />}

      <Card>
        <CardHeader>
          <CardTitle>Staff details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Staff name" error={state?.fieldErrors?.staff_name?.[0]}>
            <Input name="staff_name" placeholder="Full name" required defaultValue={s?.staff_name ?? ""} />
          </Field>
          <Field label="Category" error={state?.fieldErrors?.staff_category_id?.[0]}>
            <Select name="staff_category_id" defaultValue={s?.staff_category_id ?? ""}>
              <option value="">— Select category —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Designation">
            <Input name="designation" placeholder="e.g. Finance Officer" defaultValue={s?.designation ?? ""} />
          </Field>
          <Field label="Gender" error={state?.fieldErrors?.gender?.[0]}>
            <Select name="gender" defaultValue={s?.gender ?? ""}>
              <option value="">— Select gender —</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
          </Field>
          <Field label="Educational qualification">
            <Input name="educational_qualification" placeholder="e.g. BSc Accounting" defaultValue={s?.educational_qualification ?? ""} />
          </Field>
          <Field label="Professional qualification">
            <Input name="professional_qualification" placeholder="e.g. ACCA" defaultValue={s?.professional_qualification ?? ""} />
          </Field>
          <Field label="Date of employment">
            <Input type="date" name="date_of_employment" defaultValue={s?.date_of_employment ?? ""} />
          </Field>
          <Field label="State of origin">
            <Input name="state_of_origin" placeholder="e.g. Ogun" defaultValue={s?.state_of_origin ?? ""} />
          </Field>
          <Field label="Location">
            <Input name="location" placeholder="e.g. Lagos" defaultValue={s?.location ?? ""} />
          </Field>
          <Field label="Date of exit">
            <Input type="date" name="date_of_exit" defaultValue={s?.date_of_exit ?? ""} />
          </Field>
          <Field label="Reason for leaving" className="sm:col-span-2">
            <Textarea name="reason_for_leaving" placeholder="Optional" defaultValue={s?.reason_for_leaving ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Save staff member"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/staff")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
