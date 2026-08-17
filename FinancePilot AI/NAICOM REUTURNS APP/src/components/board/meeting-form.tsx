"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createBoardMeetingAction,
  updateBoardMeetingAction,
  type BoardActionState,
} from "@/lib/board/board-actions";
import { BOARD_MEETING_TYPE_LABELS, BOARD_MEETING_TYPES } from "@/lib/board/types";
import { MEETING_TYPE_HELP } from "@/lib/board/presets";
import type { BoardMeeting } from "@/lib/board/types";
import { meetingNumberFor } from "@/lib/board/utils";

const initialState: BoardActionState = null;

const YEARS = Array.from({ length: 2030 - 2020 + 1 }, (_, i) => 2020 + i);

export function MeetingForm({
  meeting,
  demo = false,
  existingCount = 0,
}: {
  meeting?: BoardMeeting | null;
  demo?: boolean;
  existingCount?: number;
}) {
  const isEdit = Boolean(meeting);
  const [state, formAction, pending] = useActionState(
    isEdit ? updateBoardMeetingAction : createBoardMeetingAction,
    initialState
  );
  const router = useRouter();
  const m = meeting ?? null;
  const now = new Date();
  const defaultYear = m?.financial_year ?? now.getFullYear();
  const defaultType = m?.meeting_type ?? "Q1";
  const defaultQuarter = m?.quarter ?? 1;
  const today = now.toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      {demo && (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span>
            <strong className="font-semibold text-foreground">Preview mode.</strong> Board meeting
            records are stored locally for this session.
          </span>
        </div>
      )}
      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      {isEdit && <input type="hidden" name="id" value={m!.id} />}

      <Card>
        <CardHeader>
          <CardTitle>Meeting details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="Meeting number"
            error={state?.fieldErrors?.meeting_number?.[0]}
            className="sm:col-span-2"
          >
            <Input
              name="meeting_number"
              placeholder="e.g. WMK-BRD/2026/Q2/001"
              defaultValue={
                m?.meeting_number ??
                (isEdit ? "" : meetingNumberFor(defaultYear, defaultType, existingCount))
              }
            />
          </Field>
          <Field label="Meeting type" error={state?.fieldErrors?.meeting_type?.[0]}>
            <Select
              name="meeting_type"
              defaultValue={defaultType}
              onChange={(e) => {
                const el = e.target;
                const quarterField = el.form?.elements.namedItem("quarter") as HTMLSelectElement | null;
                if (quarterField) quarterField.disabled = ["AGM", "SPECIAL"].includes(el.value);
              }}
            >
              {BOARD_MEETING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BOARD_MEETING_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Quarter" error={state?.fieldErrors?.quarter?.[0]}>
            <Select
              name="quarter"
              defaultValue={String(defaultQuarter)}
              disabled={["AGM", "SPECIAL"].includes(defaultType)}
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Financial year" error={state?.fieldErrors?.financial_year?.[0]}>
            <Select name="financial_year" defaultValue={String(defaultYear)}>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Meeting date" error={state?.fieldErrors?.meeting_date?.[0]}>
            <Input type="date" name="meeting_date" defaultValue={m?.meeting_date ?? today} required />
          </Field>
          <Field label="Time">
            <Input type="time" name="meeting_time" defaultValue={m?.meeting_time ?? ""} />
          </Field>
          <Field label="Venue">
            <Input name="venue" placeholder="e.g. Boardroom, 5th Floor" defaultValue={m?.venue ?? ""} />
          </Field>
          <Field label="Chairman">
            <Input name="chairman" placeholder="Chairman of the Board" defaultValue={m?.chairman ?? ""} />
          </Field>
          <Field label="Secretary">
            <Input name="secretary" placeholder="Company Secretary" defaultValue={m?.secretary ?? ""} />
          </Field>
        </CardContent>
        <div className="px-6 pb-6">
          <p className="text-xs text-muted-foreground">
            {MEETING_TYPE_HELP[defaultType] ?? ""}
          </p>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEdit ? "Save changes" : "Create meeting"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push(isEdit ? `/board/${m!.id}` : "/board")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
