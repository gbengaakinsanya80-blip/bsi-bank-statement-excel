"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, CheckCircle, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { ClaimSource } from "@/lib/returns/types";

function emptyClaim(): Omit<ClaimSource, "id"> {
  return {
    date_notified_by_insured: "",
    date_notified_to_insurer: "",
    insurer_name: "",
    claim_no: "",
    claim_amount: 0,
    date_discharge_voucher: "",
    insured_beneficiary: "",
    date_payment: null,
    remarks: null,
  };
}

export function ClaimsForm({
  claims,
  onRefresh,
}: {
  claims: ClaimSource[];
  onRefresh: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<ClaimSource, "id">>(emptyClaim());
  const [message, setMessage] = useState<string | null>(null);

  function startAdd() {
    setEditingId(null);
    setDraft(emptyClaim());
    setAdding(true);
  }

  function startEdit(claim: ClaimSource) {
    setAdding(false);
    setEditingId(claim.id);
    setDraft({
      date_notified_by_insured: claim.date_notified_by_insured ?? "",
      date_notified_to_insurer: claim.date_notified_to_insurer ?? "",
      insurer_name: claim.insurer_name ?? "",
      claim_no: claim.claim_no ?? "",
      claim_amount: claim.claim_amount ?? 0,
      date_discharge_voucher: claim.date_discharge_voucher ?? "",
      insured_beneficiary: claim.insured_beneficiary ?? "",
      date_payment: claim.date_payment,
      remarks: claim.remarks,
    });
  }

  function cancel() {
    setAdding(false);
    setEditingId(null);
    setDraft(emptyClaim());
  }

  function save() {
    const isEdit = editingId !== null;
    const url = isEdit ? `/api/claims/${editingId}` : "/api/claims";
    const method = isEdit ? "PATCH" : "POST";
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        setMessage(isEdit ? "Claim updated." : "Claim added.");
        cancel();
        onRefresh();
      } else {
        const err = await res.text();
        setMessage(`Error: ${err}`);
      }
    });
  }

  function remove(id: string) {
    if (!confirm("Delete this claim?")) return;
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/claims/${id}`, { method: "DELETE" });
      if (res.ok) {
        setMessage("Claim deleted.");
        onRefresh();
      }
    });
  }

  function settle(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    setMessage(null);
    startTransition(async () => {
      const res = await fetch(`/api/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date_payment: today }),
      });
      if (res.ok) {
        setMessage("Claim settled.");
        onRefresh();
      }
    });
  }

  const unsettled = claims.filter((c) => !c.date_payment || c.date_payment.trim() === "");
  const settled = claims.filter((c) => c.date_payment && c.date_payment.trim() !== "");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Claims Register</h3>
          <p className="text-xs text-muted-foreground">
            {claims.length} claim{claims.length !== 1 ? "s" : ""} total · {unsettled.length} unsettled ·{" "}
            {settled.length} settled
          </p>
        </div>
        <Button type="button" size="sm" onClick={startAdd} disabled={adding || editingId !== null}>
          <Plus className="h-4 w-4" />
          Add New Claim
        </Button>
      </div>

      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}

      {(adding || editingId !== null) && (
        <div className="rounded-md border bg-muted/20 p-4 space-y-3">
          <h4 className="text-sm font-semibold">
            {editingId ? "Edit Claim" : "New Claim"}
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Date Notified by Insured">
              <Input
                type="date"
                value={draft.date_notified_by_insured ?? ""}
                onChange={(e) => setDraft({ ...draft, date_notified_by_insured: e.target.value })}
              />
            </Field>
            <Field label="Date Notified to Insurer">
              <Input
                type="date"
                value={draft.date_notified_to_insurer ?? ""}
                onChange={(e) => setDraft({ ...draft, date_notified_to_insurer: e.target.value })}
              />
            </Field>
            <Field label="Name of Insurer">
              <Input
                value={draft.insurer_name ?? ""}
                onChange={(e) => setDraft({ ...draft, insurer_name: e.target.value })}
                placeholder="e.g. AIICO"
              />
            </Field>
            <Field label="Claim No.">
              <Input
                value={draft.claim_no ?? ""}
                onChange={(e) => setDraft({ ...draft, claim_no: e.target.value })}
                placeholder="e.g. CLM/2026/001"
              />
            </Field>
            <Field label="Claim Amount">
              <Input
                type="number"
                value={draft.claim_amount ?? 0}
                onChange={(e) => setDraft({ ...draft, claim_amount: Number(e.target.value) })}
              />
            </Field>
            <Field label="Name of Insured/Beneficiary">
              <Input
                value={draft.insured_beneficiary ?? ""}
                onChange={(e) => setDraft({ ...draft, insured_beneficiary: e.target.value })}
                placeholder="e.g. NNPCL"
              />
            </Field>
            <Field label="Date of Discharge Voucher">
              <Input
                type="date"
                value={draft.date_discharge_voucher ?? ""}
                onChange={(e) => setDraft({ ...draft, date_discharge_voucher: e.target.value })}
              />
            </Field>
            <Field label="Remarks">
              <Input
                value={draft.remarks ?? ""}
                onChange={(e) => setDraft({ ...draft, remarks: e.target.value })}
                placeholder="Optional notes"
              />
            </Field>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" onClick={save} disabled={pending}>
              {editingId ? "Update" : "Add Claim"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {claims.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground italic py-4 text-center">
          No claims recorded yet. Click &quot;Add New Claim&quot; to get started.
        </p>
      )}

      {claims.length > 0 && (
        <div className="space-y-1">
          {claims.map((c) => {
            const isSettled = c.date_payment && c.date_payment.trim() !== "";
            const isEditing = editingId === c.id;
            return (
              <div
                key={c.id}
                className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm ${
                  isSettled ? "bg-muted/30 opacity-70" : "bg-background"
                } ${isEditing ? "ring-2 ring-primary" : ""}`}
              >
                <span className="w-8 text-right text-muted-foreground">
                  {claims.indexOf(c) + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium truncate">{c.insured_beneficiary || "—"}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="truncate">{c.insurer_name || "—"}</span>
                    {c.claim_no && (
                      <>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">{c.claim_no}</span>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>Notified: {c.date_notified_to_insurer || "—"}</span>
                    <span>· Amount: {(c.claim_amount ?? 0).toLocaleString()}</span>
                    {isSettled ? (
                      <span className="text-green-600">· Settled: {c.date_payment}</span>
                    ) : (
                      <span className="text-amber-600">· Awaiting Payment</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isSettled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => settle(c.id)}
                      title="Mark as settled"
                    >
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => startEdit(c)}
                    title="Edit claim"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => remove(c.id)}
                    title="Delete claim"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
