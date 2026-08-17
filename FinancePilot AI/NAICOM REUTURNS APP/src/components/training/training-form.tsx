"use client";

import { useActionState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createTrainingAction,
  updateTrainingAction,
  type TrainingActionState,
} from "@/lib/services/training-actions";
import type { TrainingRecord } from "@/lib/types/database";
import { useState } from "react";

const initialState: TrainingActionState = null;

const TRAINING_TYPES = [
  { value: "TECHNICAL", label: "Technical" },
  { value: "COMPLIANCE", label: "Compliance / Regulatory" },
  { value: "MANAGEMENT", label: "Management" },
  { value: "SAFETY", label: "Safety / Risk" },
  { value: "SOFT_SKILLS", label: "Soft Skills" },
  { value: "OTHER", label: "Other" },
];

const STATUS_OPTIONS = [
  { value: "COMPLETED", label: "Completed" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CANCELLED", label: "Cancelled" },
];

export function TrainingForm({
  record,
  demo = false,
}: {
  record?: TrainingRecord | null;
  demo?: boolean;
}) {
  const isEdit = Boolean(record);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateTrainingAction : createTrainingAction,
    initialState
  );
  const router = useRouter();
  const r = record ?? null;

  const [certName, setCertName] = useState(r?.certificate_file_name ?? "");
  const [certData, setCertData] = useState(r?.certificate_file_data ?? "");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File must be under 5 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCertName(file.name);
      setCertData(result);
    };
    reader.readAsDataURL(file);
  }

  function clearCert() {
    setCertName("");
    setCertData("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <form action={formAction} className="space-y-6" encType="multipart/form-data">
      {demo && (
        <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <strong className="font-semibold text-foreground">Preview mode.</strong> Training records
          you save are stored locally for this session.
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {isEdit && <input type="hidden" name="id" value={r!.id} />}
      <input type="hidden" name="existing_cert_name" value={certName} />
      <input type="hidden" name="existing_cert_data" value={certData} />

      <Card>
        <CardHeader>
          <CardTitle>Staff & Training Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Staff name *" error={state?.fieldErrors?.staff_name?.[0]}>
            <Input
              name="staff_name"
              placeholder="Full name of staff"
              required
              defaultValue={r?.staff_name ?? ""}
            />
          </Field>
          <Field label="Position / Designation">
            <Input
              name="position"
              placeholder="e.g. Finance Officer"
              defaultValue={r?.position ?? ""}
            />
          </Field>
          <Field label="Training title *" error={state?.fieldErrors?.training_title?.[0]}>
            <Input
              name="training_title"
              placeholder="Title of the training programme"
              required
              defaultValue={r?.training_title ?? ""}
            />
          </Field>
          <Field label="Training type">
            <Select name="training_type" defaultValue={r?.training_type ?? ""}>
              <option value="">— Select —</option>
              {TRAINING_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Organizer / Provider *" error={state?.fieldErrors?.organizer?.[0]}>
            <Input
              name="organizer"
              placeholder="e.g. NAICOM, Chartered Insurance Institute"
              required
              defaultValue={r?.organizer ?? ""}
            />
          </Field>
          <Field label="Training location">
            <Input
              name="training_location"
              placeholder="e.g. Lagos, Virtual, Abuja Office"
              defaultValue={r?.training_location ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule & Cost</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Training date *" error={state?.fieldErrors?.training_date?.[0]}>
            <Input
              type="date"
              name="training_date"
              required
              defaultValue={r?.training_date ?? ""}
            />
          </Field>
          <Field label="End date (if multi-day)">
            <Input
              type="date"
              name="training_end_date"
              defaultValue={r?.training_end_date ?? ""}
            />
          </Field>
          <Field label="Duration (hours)">
            <Input
              type="number"
              name="duration_hours"
              step="0.5"
              min="0"
              placeholder="e.g. 8"
              defaultValue={r?.duration_hours != null ? String(r.duration_hours) : ""}
            />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue={r?.status ?? "COMPLETED"}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Training cost (₦)">
            <Input
              type="number"
              name="training_cost"
              step="0.01"
              min="0"
              placeholder="0.00"
              defaultValue={r?.training_cost != null ? String(r.training_cost) : ""}
            />
          </Field>
          <Field label="Certificate available">
            <label className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                name="certificate_available"
                defaultChecked={r?.certificate_available ?? false}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="text-sm">Yes, certificate obtained</span>
            </label>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Certificate Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {certName && (
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <span className="truncate font-medium">{certName}</span>
              <button
                type="button"
                onClick={clearCert}
                className="ml-auto rounded p-0.5 hover:bg-destructive/10"
                aria-label="Remove certificate"
              >
                <X className="h-4 w-4 text-destructive" />
              </button>
            </div>
          )}
          <div>
            <input
              ref={fileRef}
              type="file"
              name="certificate"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              {certName ? "Replace certificate" : "Upload certificate (PDF, JPG, PNG — max 5 MB)"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learning Outcomes & Remarks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="What was learned / Key takeaways">
            <Textarea
              name="what_was_learned"
              rows={4}
              placeholder="Describe the key topics covered, skills acquired, or knowledge gained..."
              defaultValue={r?.what_was_learned ?? ""}
            />
          </Field>
          <Field label="Additional remarks">
            <Textarea
              name="remarks"
              rows={2}
              placeholder="Any other relevant notes..."
              defaultValue={r?.remarks ?? ""}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Save training record"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/training")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
