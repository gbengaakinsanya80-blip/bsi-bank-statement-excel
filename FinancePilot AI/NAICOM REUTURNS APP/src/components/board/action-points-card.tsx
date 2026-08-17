"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addActionPointAction,
  removeActionPointAction,
  updateActionPointStatusAction,
} from "@/lib/board/board-actions";
import { ACTION_STATUS_OPTIONS } from "@/lib/board/presets";
import type { BoardActionPoint } from "@/lib/board/types";

export function ActionPointsCard({
  meetingId,
  actionPoints,
  locked,
}: {
  meetingId: string;
  actionPoints: BoardActionPoint[];
  locked: boolean;
}) {
  const [action, setAction] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Action points</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {actionPoints.length > 0 ? (
          <div className="space-y-2">
            {actionPoints.map((a, idx) => (
              <div key={a.id} className="rounded-md border px-3 py-2 text-sm">
                <p className="font-medium">
                  {idx + 1}. {a.action}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {a.responsible_person ? `${a.responsible_person}` : ""}
                  {a.due_date ? ` · due ${a.due_date}` : ""}
                  {a.remarks ? ` · ${a.remarks}` : ""}
                </p>
                {!locked && (
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <form action={updateActionPointStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={meetingId} />
                      <input type="hidden" name="action_id" value={a.id} />
                      <Select name="status" defaultValue={a.status} className="h-8 w-36 text-xs">
                        {ACTION_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" variant="outline" size="sm">
                        Update
                      </Button>
                    </form>
                    <form action={removeActionPointAction}>
                      <input type="hidden" name="id" value={meetingId} />
                      <input type="hidden" name="action_id" value={a.id} />
                      <Button type="submit" variant="ghost" size="icon" aria-label="Remove action point">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No action points recorded.</p>
        )}

        {!locked && (
          <form action={addActionPointAction} className="space-y-3 rounded-md border bg-muted/30 p-3">
            <input type="hidden" name="id" value={meetingId} />
            <Field label="Action">
              <Textarea
                name="action"
                required
                rows={2}
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="e.g. MD to circulate updated NAICOM submission tracker"
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
                  {ACTION_STATUS_OPTIONS.map((o) => (
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
              Add action point
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
