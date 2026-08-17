"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { transitionStatusAction } from "@/lib/board/board-actions";
import { MEETING_STATUS_TRANSITIONS, type MeetingStatus } from "@/lib/board/types";

const NEXT_LABELS: Partial<Record<MeetingStatus, string>> = {
  REVIEW: "Send for review",
  APPROVED: "Approve minutes",
  FINAL: "Finalize minutes",
  DRAFT: "Reopen draft",
};

export function StatusActions({
  meetingId,
  status,
}: {
  meetingId: string;
  status: MeetingStatus;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const nextStates = MEETING_STATUS_TRANSITIONS[status] ?? [];

  function submit(next: MeetingStatus) {
    setError(null);
    startTransition(() => {
      const form = new FormData();
      form.set("id", meetingId);
      form.set("status", next);
      if (reason) form.set("reason", reason);
      transitionStatusAction(form).then((res) => {
        if (res && res.error) setError(res.error);
        else {
          setReason("");
          router.refresh();
        }
      });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Approval workflow</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Minutes flow through Draft → Awaiting review → Approved → Final. Only administrators can
          approve or finalize.
        </p>
        {nextStates.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2">
              {nextStates.map((next) => (
                <Button
                  key={next}
                  type="button"
                  variant={next === "APPROVED" || next === "FINAL" ? "default" : "outline"}
                  size="sm"
                  disabled={pending}
                  onClick={() => submit(next)}
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {NEXT_LABELS[next] ?? next}
                </Button>
              ))}
            </div>
            {nextStates.includes("REVIEW") && status === "APPROVED" && (
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for reopening (optional)"
              />
            )}
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
