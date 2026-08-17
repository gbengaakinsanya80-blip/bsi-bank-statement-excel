"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { saveAgendaAction } from "@/lib/board/board-actions";
import type { BoardAgendaItem } from "@/lib/board/types";

export function AgendaCard({
  meetingId,
  agenda,
  locked,
}: {
  meetingId: string;
  agenda: BoardAgendaItem[];
  locked: boolean;
}) {
  const [value, setValue] = useState(
    agenda.length
      ? agenda.map((a) => a.title).join("\n")
      : ["Opening", "Confirmation of previous minutes", "Matters arising", "Any other business", "Closing"].join("\n")
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agenda</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {locked ? (
          <ol className="list-decimal space-y-1 pl-6 text-sm">
            {agenda.map((a) => (
              <li key={a.id}>{a.title}</li>
            ))}
          </ol>
        ) : (
          <form action={saveAgendaAction} className="space-y-3">
            <input type="hidden" name="id" value={meetingId} />
            <Textarea
              name="agenda"
              rows={8}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="One agenda item per line"
            />
            <Button type="submit" size="sm">
              <Save className="h-4 w-4" />
              Save agenda
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
