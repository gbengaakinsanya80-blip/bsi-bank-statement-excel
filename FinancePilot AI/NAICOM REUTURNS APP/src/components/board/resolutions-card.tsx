"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addResolutionAction,
  removeResolutionAction,
} from "@/lib/board/board-actions";
import { RESOLUTION_STATUS_OPTIONS } from "@/lib/board/presets";
import type { BoardResolution } from "@/lib/board/types";

export function ResolutionsCard({
  meetingId,
  resolutions,
  locked,
}: {
  meetingId: string;
  resolutions: BoardResolution[];
  locked: boolean;
}) {
  const [resolution, setResolution] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resolutions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {resolutions.length > 0 ? (
          <div className="space-y-2">
            {resolutions.map((r) => (
              <div key={r.id} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">
                  Resolution {r.resolution_number}
                  {r.agenda_item ? <span className="text-muted-foreground"> · {r.agenda_item}</span> : null}
                </p>
                <p className="mt-1">{r.resolution}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {r.status.replace(/_/g, " ")}
                  {r.responsible_person ? ` · ${r.responsible_person}` : ""}
                  {r.due_date ? ` · due ${r.due_date}` : ""}
                </p>
                {!locked && (
                  <div className="mt-2 flex justify-end">
                    <form action={removeResolutionAction}>
                      <input type="hidden" name="id" value={meetingId} />
                      <input type="hidden" name="resolution_id" value={r.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No resolutions recorded.</p>
        )}

        {!locked && (
          <form action={addResolutionAction} className="space-y-3 rounded-md border bg-muted/30 p-3">
            <input type="hidden" name="id" value={meetingId} />
            <Field label="Agenda item (optional)">
              <Input name="agenda_item" placeholder="e.g. Financial performance" />
            </Field>
            <Field label="Resolution text">
              <Textarea
                name="resolution"
                required
                rows={3}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="The Board resolved that…"
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Responsible person">
                <Input name="responsible_person" placeholder="Name" />
              </Field>
              <Field label="Due date">
                <Input type="date" name="due_date" />
              </Field>
              <Field label="Status">
                <Select name="status" defaultValue="OPEN">
                  {RESOLUTION_STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Remarks (optional)">
              <Input name="remarks" placeholder="Notes" />
            </Field>
            <Button type="submit" size="sm">
              <Plus className="h-4 w-4" />
              Add resolution
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
