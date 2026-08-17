import { Badge } from "@/components/ui/badge";
import { MEETING_STATUS_LABELS, type MeetingStatus } from "@/lib/board/types";
import { cn } from "@/lib/utils/cn";

const STATUS_VARIANTS: Record<MeetingStatus, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  DRAFT: "secondary",
  REVIEW: "warning",
  APPROVED: "default",
  FINAL: "success",
  CANCELLED: "destructive",
};

export function MeetingStatusBadge({ status, className }: { status: MeetingStatus; className?: string }) {
  return (
    <Badge variant={STATUS_VARIANTS[status] ?? "secondary"} className={cn(className)}>
      {MEETING_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
