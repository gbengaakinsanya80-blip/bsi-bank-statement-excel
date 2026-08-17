"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addAttendeeAction,
  removeAttendeeAction,
} from "@/lib/board/board-actions";
import { BOARD_MEMBER_PRESETS } from "@/lib/board/presets";
import { ATTENDANCE_OPTIONS } from "@/lib/board/presets";
import type { BoardAttendee } from "@/lib/board/types";

export function AttendeesCard({
  meetingId,
  attendees,
  locked,
}: {
  meetingId: string;
  attendees: BoardAttendee[];
  locked: boolean;
}) {
  const [presetName, setPresetName] = useState("");
  const [presetDesignation, setPresetDesignation] = useState("");

  function applyPreset(value: string) {
    const preset = BOARD_MEMBER_PRESETS.find((p) => p.name === value);
    setPresetName(preset?.name ?? value);
    setPresetDesignation(preset?.designation ?? "");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Attendance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {attendees.length > 0 ? (
          <div className="space-y-2">
            {attendees.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.designation || "—"} · {a.presence.replace(/_/g, " ")}
                  </p>
                </div>
                {!locked && (
                  <form action={removeAttendeeAction}>
                    <input type="hidden" name="id" value={meetingId} />
                    <input type="hidden" name="attendee_id" value={a.id} />
                    <Button type="submit" variant="ghost" size="icon" aria-label="Remove attendee">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No attendees recorded.</p>
        )}

        {!locked && (
          <form action={addAttendeeAction} className="space-y-3 rounded-md border bg-muted/30 p-3">
            <input type="hidden" name="id" value={meetingId} />
            <Field label="Quick add from board register">
              <Select
                value={presetName}
                onChange={(e) => applyPreset(e.target.value)}
              >
                <option value="">— Select a board member —</option>
                {BOARD_MEMBER_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} — {p.designation}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Name">
                <Input
                  name="name"
                  required
                  placeholder="Full name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                />
              </Field>
              <Field label="Designation">
                <Input
                  name="designation"
                  placeholder="e.g. Non-Executive Director"
                  value={presetDesignation}
                  onChange={(e) => setPresetDesignation(e.target.value)}
                />
              </Field>
            </div>
            <Field label="Presence">
              <Select name="presence" defaultValue="PRESENT">
                {ATTENDANCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4" />
              Add attendee
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
