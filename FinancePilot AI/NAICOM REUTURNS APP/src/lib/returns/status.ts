export const RETURN_STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ["IN_PROGRESS", "READY_FOR_REVIEW"],
  IN_PROGRESS: ["READY_FOR_REVIEW", "DRAFT"],
  READY_FOR_REVIEW: ["REVIEWED", "DRAFT"],
  REVIEWED: ["APPROVED", "READY_FOR_REVIEW", "DRAFT"],
  APPROVED: ["SUBMITTED", "DRAFT"],
  SUBMITTED: ["CLOSED", "DRAFT"],
  CLOSED: [],
  OVERDUE: ["DRAFT"],
  NOT_APPLICABLE: [],
};

export const COMPLETED_STATUSES = ["APPROVED", "SUBMITTED", "CLOSED", "EXPORTED"];

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (RETURN_STATUS_TRANSITIONS[from] ?? []).includes(to);
}

export function nextStatuses(status: string): string[] {
  return RETURN_STATUS_TRANSITIONS[status] ?? [];
}

export type ReturnStatusVariant =
  | "secondary"
  | "warning"
  | "success"
  | "outline"
  | "destructive";

export function statusVariant(status: string): ReturnStatusVariant {
  if (COMPLETED_STATUSES.includes(status)) return "success";
  if (status === "OVERDUE") return "destructive";
  if (status === "READY_FOR_REVIEW") return "warning";
  if (status === "IN_PROGRESS" || status === "REVIEWED" || status === "SUBMITTED") return "warning";
  return "secondary";
}
