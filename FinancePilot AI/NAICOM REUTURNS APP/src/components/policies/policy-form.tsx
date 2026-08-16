"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createPolicyAction, type PolicyActionState } from "@/lib/services/policy-actions";
import type { Client, Currency, Insurer, RiskClass } from "@/lib/types/database";

const initialState: PolicyActionState = null;

export function PolicyForm({
  clients,
  insurers,
  riskClasses,
  currencies,
  demo = false,
}: {
  clients: Client[];
  insurers: Insurer[];
  riskClasses: RiskClass[];
  currencies: Currency[];
  demo?: boolean;
}) {
  const [state, formAction, pending] = useActionState(createPolicyAction, initialState);
  const router = useRouter();

  return (
    <form action={formAction} className="space-y-6">
      {demo && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold text-foreground">Preview mode.</strong> Policies you
            save are stored locally for this session and feed the returns engine.
          </span>
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Policy details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Policy number" error={state?.fieldErrors?.policy_number?.[0]}>
            <Input name="policy_number" placeholder="WMK/2026/0001" required />
          </Field>
          <Field label="Endorsement number" error={state?.fieldErrors?.endorsement_number?.[0]}>
            <Input name="endorsement_number" placeholder="Optional" />
          </Field>
          <Field label="Transaction type" error={state?.fieldErrors?.transaction_type?.[0]}>
            <Select name="transaction_type" defaultValue="NEW">
              <option value="NEW">NEW</option>
              <option value="RENEWAL">RENEWAL</option>
              <option value="ENDORSEMENT">ENDORSEMENT</option>
              <option value="DEBIT_NOTE">DEBIT_NOTE</option>
              <option value="CREDIT_NOTE">CREDIT_NOTE</option>
              <option value="CANCELLATION">CANCELLATION</option>
            </Select>
          </Field>
          <Field label="Client" error={state?.fieldErrors?.client_id?.[0]}>
            <Select name="client_id" defaultValue="">
              <option value="">— Select client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Insured name (assured)" error={state?.fieldErrors?.insured_name?.[0]}>
            <Input name="insured_name" placeholder="As it appears on the policy" />
          </Field>
          <Field label="Insurer" error={state?.fieldErrors?.insurer_id?.[0]}>
            <Select name="insurer_id" defaultValue="">
              <option value="">— Select insurer —</option>
              {insurers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.insurer_name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Risk type" error={state?.fieldErrors?.risk_type?.[0]}>
            <Select name="risk_type" defaultValue="">
              <option value="">— Select risk class —</option>
              {riskClasses.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Class of business" error={state?.fieldErrors?.class_of_business?.[0]}>
            <Input name="class_of_business" placeholder="Optional" />
          </Field>
          <Field label="Currency" error={state?.fieldErrors?.currency?.[0]}>
            <Select name="currency" defaultValue="NGN">
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} {c.symbol ?? ""}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cover & dates</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Transaction date">
            <Input type="date" name="transaction_date" />
          </Field>
          <Field label="Cover from">
            <Input type="date" name="cover_from" />
          </Field>
          <Field label="Cover to">
            <Input type="date" name="cover_to" />
          </Field>
          <Field label="Premium collection date">
            <Input type="date" name="premium_collection_date" />
          </Field>
          <Field label="Premium payment date">
            <Input type="date" name="premium_payment_date" />
          </Field>
          <Field label="Receipt number">
            <Input name="receipt_number" placeholder="Optional" />
          </Field>
          <Field label="Debit note number">
            <Input name="debit_note_number" placeholder="Optional" />
          </Field>
          <Field label="Credit note number">
            <Input name="credit_note_number" placeholder="Optional" />
          </Field>
          <Field label="Branch / location">
            <Input name="branch_location" placeholder="Optional" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Amounts (NGN unless another currency selected)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Sum insured" error={state?.fieldErrors?.sum_insured?.[0]}>
            <Input type="number" step="0.01" min="0" name="sum_insured" />
          </Field>
          <Field label="Gross premium" error={state?.fieldErrors?.gross_premium?.[0]}>
            <Input type="number" step="0.01" min="0" name="gross_premium" />
          </Field>
          <Field label="Premium collected" error={state?.fieldErrors?.premium_collected?.[0]}>
            <Input type="number" step="0.01" min="0" name="premium_collected" />
          </Field>
          <Field label="Premium paid to insurer" error={state?.fieldErrors?.premium_paid_to_insurer?.[0]}>
            <Input type="number" step="0.01" min="0" name="premium_paid_to_insurer" />
          </Field>
          <Field label="Brokerage commission" error={state?.fieldErrors?.brokerage_commission?.[0]}>
            <Input type="number" step="0.01" min="0" name="brokerage_commission" />
          </Field>
          <Field label="Commission rate (%)" error={state?.fieldErrors?.commission_rate?.[0]}>
            <Input type="number" step="0.01" min="0" max="100" name="commission_rate" />
          </Field>
          <Field label="Tax">
            <Input type="number" step="0.01" min="0" name="tax" />
          </Field>
          <Field label="Other deductions">
            <Input type="number" step="0.01" min="0" name="other_deductions" />
          </Field>
          <Field label="Net premium">
            <Input type="number" step="0.01" min="0" name="net_premium" />
          </Field>
          <Field label="Amount received">
            <Input type="number" step="0.01" min="0" name="amount_received" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6">
          <Field label="Remarks">
            <Textarea name="remarks" placeholder="Optional notes" />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save policy
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/policies")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
