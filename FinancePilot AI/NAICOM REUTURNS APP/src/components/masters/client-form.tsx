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
  createClientAction,
  updateClientAction,
  type ClientActionState,
} from "@/lib/services/client-actions";
import type { Client } from "@/lib/types/database";

const initialState: ClientActionState = null;

export function ClientForm({ client, demo = false }: { client?: Client | null; demo?: boolean }) {
  const isEdit = Boolean(client);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateClientAction : createClientAction,
    initialState
  );
  const router = useRouter();
  const c = client ?? null;

  return (
    <form action={formAction} className="space-y-6">
      {demo && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold text-foreground">Preview mode.</strong> Clients you
            save are stored locally for this session.
          </span>
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {isEdit && <input type="hidden" name="id" value={c!.id} />}

      <Card>
        <CardHeader>
          <CardTitle>Client details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Client name" error={state?.fieldErrors?.client_name?.[0]}>
            <Input name="client_name" placeholder="e.g. Zenith Bank Plc" required defaultValue={c?.client_name ?? ""} />
          </Field>
          <Field label="Industry">
            <Input name="industry" placeholder="e.g. Banking" defaultValue={c?.industry ?? ""} />
          </Field>
          <Field label="Status" error={state?.fieldErrors?.status?.[0]}>
            <Select name="status" defaultValue={c?.status ?? "ACTIVE"}>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
            </Select>
          </Field>
          <Field label="Contact person">
            <Input name="contact_person" placeholder="Optional" defaultValue={c?.contact_person ?? ""} />
          </Field>
          <Field label="Phone">
            <Input name="phone" placeholder="Optional" defaultValue={c?.phone ?? ""} />
          </Field>
          <Field label="Email" error={state?.fieldErrors?.email?.[0]}>
            <Input name="email" type="email" placeholder="Optional" defaultValue={c?.email ?? ""} />
          </Field>
          <Field label="Address" className="sm:col-span-2 lg:col-span-3">
            <Textarea name="address" placeholder="Optional" defaultValue={c?.address ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Save client"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/clients")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
