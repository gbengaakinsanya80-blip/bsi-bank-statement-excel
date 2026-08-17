import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarCheck, Download, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { MeetingStatusBadge } from "@/components/board/status-badge";
import { MinutesForm } from "@/components/board/minutes-form";
import { AttendeesCard } from "@/components/board/attendees-card";
import { AgendaCard } from "@/components/board/agenda-card";
import { ResolutionsCard } from "@/components/board/resolutions-card";
import { ActionPointsCard } from "@/components/board/action-points-card";
import { DocumentsCard } from "@/components/board/documents-card";
import { StatusActions } from "@/components/board/status-actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMeeting } from "@/lib/services/board-service";
import { isBoardEditLocked, meetingTypeLabel } from "@/lib/board/types";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Board Meeting" };

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const meeting = await getMeeting(supabase, id);
  if (!meeting) notFound();

  const locked = isBoardEditLocked(meeting.status);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{meeting.meeting_number}</h1>
            <MeetingStatusBadge status={meeting.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {meetingTypeLabel(meeting.meeting_type)} · {formatDate(meeting.meeting_date)}
            {meeting.meeting_time ? ` at ${meeting.meeting_time}` : ""} · {meeting.venue ?? "Venue TBC"}
          </p>
          {meeting.reopen_reason && (
            <p className="mt-1 text-xs text-warning">Reopened: {meeting.reopen_reason}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/api/board/${meeting.id}/pdf`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </Link>
          {!locked && (
            <Link
              href={`/board/${meeting.id}/edit`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <Pencil className="h-4 w-4" />
              Edit details
            </Link>
          )}
        </div>
      </div>

      {meeting.period_start && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <span>
            Links to the NAICOM reporting period{" "}
            <strong>
              {meeting.period_start} to {meeting.period_end}
            </strong>{" "}
            for Q{meeting.quarter} {meeting.financial_year}.
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Minutes</CardTitle>
        </CardHeader>
        <CardContent>
          {locked ? (
            <div
              className="min-h-[200px] rounded-md border bg-muted/20 px-4 py-3 text-sm leading-relaxed"
              dangerouslySetInnerHTML={{ __html: meeting.minutes || "<p>No minutes recorded.</p>" }}
            />
          ) : (
            <MinutesForm meeting={meeting} initialHtml={meeting.minutes} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AttendeesCard meetingId={meeting.id} attendees={meeting.attendees} locked={locked} />
        <AgendaCard meetingId={meeting.id} agenda={meeting.agenda} locked={locked} />
        <ResolutionsCard meetingId={meeting.id} resolutions={meeting.resolutions} locked={locked} />
        <ActionPointsCard meetingId={meeting.id} actionPoints={meeting.action_points} locked={locked} />
        <DocumentsCard meetingId={meeting.id} documents={meeting.documents} locked={locked} />
        <StatusActions meetingId={meeting.id} status={meeting.status} />
      </div>
    </div>
  );
}
