"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileCheck2,
  Loader2,
  Play,
  RotateCcw,
  Send,
  Stamp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateReturnStatusAction } from "@/lib/returns/return-actions";

interface Action {
  next: string;
  label: string;
  icon: typeof Send;
  variant: "default" | "outline";
}

function actionsFor(status: string): Action[] {
  switch (status) {
    case "DRAFT":
      return [
        { next: "IN_PROGRESS", label: "Start editing", icon: Play, variant: "outline" },
        { next: "READY_FOR_REVIEW", label: "Submit for review", icon: Send, variant: "default" },
      ];
    case "IN_PROGRESS":
      return [
        { next: "READY_FOR_REVIEW", label: "Submit for review", icon: Send, variant: "default" },
        { next: "DRAFT", label: "Back to draft", icon: RotateCcw, variant: "outline" },
      ];
    case "READY_FOR_REVIEW":
      return [
        { next: "REVIEWED", label: "Begin review", icon: CheckCircle2, variant: "default" },
        { next: "DRAFT", label: "Back to draft", icon: RotateCcw, variant: "outline" },
      ];
    case "REVIEWED":
      return [
        { next: "APPROVED", label: "Approve", icon: CheckCircle2, variant: "default" },
        { next: "READY_FOR_REVIEW", label: "Back to review", icon: RotateCcw, variant: "outline" },
        { next: "DRAFT", label: "Back to draft", icon: RotateCcw, variant: "outline" },
      ];
    case "APPROVED":
      return [
        { next: "SUBMITTED", label: "Mark submitted", icon: Stamp, variant: "default" },
        { next: "DRAFT", label: "Reopen draft", icon: RotateCcw, variant: "outline" },
      ];
    case "SUBMITTED":
      return [
        { next: "CLOSED", label: "Close return", icon: FileCheck2, variant: "default" },
        { next: "DRAFT", label: "Reopen draft", icon: RotateCcw, variant: "outline" },
      ];
    case "OVERDUE":
      return [{ next: "DRAFT", label: "Acknowledge & start", icon: Play, variant: "default" }];
    default:
      return [];
  }
}

export function ReturnStatusActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function transition(next: string) {
    setPending(next);
    setError(null);
    try {
      const res = await updateReturnStatusAction(id, next);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setPending(null);
    }
  }

  const actions = actionsFor(status);

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((a) => {
        const Icon = a.icon;
        return (
          <Button
            key={a.next}
            variant={a.variant}
            size="sm"
            disabled={pending !== null}
            onClick={() => transition(a.next)}
          >
            {pending === a.next ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Icon className="h-4 w-4" />
            )}
            {a.label}
          </Button>
        );
      })}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
