"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createInsurerAction,
  updateInsurerAction,
  type InsurerActionState,
} from "@/lib/services/insurer-actions";
import type { Insurer } from "@/lib/types/database";

const initialState: InsurerActionState = null;

export function InsurerForm({ insurer, demo = false }: { insurer?: Insurer | null; demo?: boolean }) {
  const isEdit = Boolean(insurer);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateInsurerAction : createInsurerAction,
    initialState
  );
  const router = useRouter();
  const i = insurer ?? null;

  return (
    <form action={formAction} className="space-y-6">
      {demo && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold text-foreground">Preview mode.</strong> Insurers you
            save are stored locally for this session.
          </span>
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {isEdit && <input type="hidden" name="id" value={i!.id} />}

      <Card>
        <CardHeader>
          <CardTitle>Insurer details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Insurer name" error={state?.fieldErrors?.insurer_name?.[0]}>
            <Input name="insurer_name" placeholder="e.g. AXA Mansard Insurance Plc" required defaultValue={i?.insurer_name ?? ""} />
          </Field>
          <Field label="NAICOM code">
            <Input name="naicom_code" placeholder="Optional" defaultValue={i?.naicom_code ?? ""} />
          </Field>
          <Field label="Contact">
            <Input name="contact" placeholder="Optional" defaultValue={i?.contact ?? ""} />
          </Field>
          <Field label="Email" error={state?.fieldErrors?.email?.[0]}>
            <Input name="email" type="email" placeholder="Optional" defaultValue={i?.email ?? ""} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <Textarea name="address" placeholder="Optional" defaultValue={i?.address ?? ""} />
          </Field>
          <Field label="Status">
            <label className="flex items-center gap-2 pt-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={i?.active ?? true} className="h-4 w-4 rounded border-input" />
              Active
            </label>
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Save insurer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/insurers")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
