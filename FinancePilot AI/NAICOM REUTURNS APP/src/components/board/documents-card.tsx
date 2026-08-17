"use client";

import { FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Select } from "@/components/ui/field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  addDocumentAction,
  removeDocumentAction,
} from "@/lib/board/board-actions";
import { DOCUMENT_CATEGORY_OPTIONS } from "@/lib/board/presets";
import { DOCUMENT_CATEGORY_LABELS } from "@/lib/board/types";
import type { BoardDocument } from "@/lib/board/types";

export function DocumentsCard({
  meetingId,
  documents,
  locked,
}: {
  meetingId: string;
  documents: BoardDocument[];
  locked: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {documents.length > 0 ? (
          <div className="space-y-2">
            {documents.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm">
                <div className="flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category}
                      {d.uploaded_by ? ` · uploaded by ${d.uploaded_by}` : ""}
                    </p>
                  </div>
                </div>
                {!locked && (
                  <form action={removeDocumentAction}>
                    <input type="hidden" name="id" value={meetingId} />
                    <input type="hidden" name="document_id" value={d.id} />
                    <Button type="submit" variant="ghost" size="icon" aria-label="Remove document">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </form>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No documents recorded.</p>
        )}

        {!locked && (
          <form action={addDocumentAction} className="space-y-3 rounded-md border bg-muted/30 p-3">
            <input type="hidden" name="id" value={meetingId} />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Document name">
                <Input name="name" required placeholder="e.g. Signed Q1 minutes.pdf" />
              </Field>
              <Field label="Category">
                <Select name="category" defaultValue="SUPPORTING_DOCUMENT">
                  {DOCUMENT_CATEGORY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Path / reference (optional)">
              <Input name="path" placeholder="e.g. /files/board/q1-minutes-signed.pdf" />
            </Field>
            <Button type="submit" size="sm">
              <Upload className="h-4 w-4" />
              Add document reference
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
