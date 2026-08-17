import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { DeleteButton } from "@/components/masters/delete-button";
import { MeetingStatusBadge } from "@/components/board/status-badge";
import { createServerSupabase } from "@/lib/supabase/server";
import { listMeetings } from "@/lib/services/board-service";
import { deleteBoardMeetingAction } from "@/lib/board/board-actions";
import { meetingTypeLabel } from "@/lib/board/types";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Board Meetings" };

export default async function BoardPage() {
  const supabase = await createServerSupabase();
  const meetings = await listMeetings(supabase);

  const outstanding = meetings.flatMap((m) =>
    m.action_points.filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS")
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Users className="h-6 w-6" />
            Board Meetings
          </h1>
          <p className="text-sm text-muted-foreground">
            Register, minutes, resolutions and action points. Quarterly meetings link to the NAICOM
            compliance calendar.
          </p>
        </div>
        <Link href="/board/new" className={buttonVariants({ size: "sm" })}>
          <Plus className="h-4 w-4" />
          New meeting
        </Link>
      </div>

      {outstanding > 0 && (
        <div className="flex items-center justify-between rounded-md border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
          <span>
            <strong className="font-medium">{outstanding}</strong> action point
            {outstanding === 1 ? " is" : "s are"} still open across board meetings.
          </span>
          <Link href="/board" className="text-xs font-medium text-primary hover:underline">
            Review
          </Link>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Meeting register ({meetings.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Meeting number</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Attendees</TableHead>
                <TableHead>Resolutions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetings.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No meetings yet. Click &ldquo;New meeting&rdquo; to register one.
                  </TableCell>
                </TableRow>
              )}
              {meetings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link href={`/board/${m.id}`} className="font-medium text-primary hover:underline">
                      {m.meeting_number}
                    </Link>
                  </TableCell>
                  <TableCell>{meetingTypeLabel(m.meeting_type)}</TableCell>
                  <TableCell>{formatDate(m.meeting_date)}</TableCell>
                  <TableCell>
                    {m.period_start ? `${m.period_start} → ${m.period_end}` : "N/A"}
                  </TableCell>
                  <TableCell>{m.attendees.length}</TableCell>
                  <TableCell>{m.resolutions.length}</TableCell>
                  <TableCell>
                    <MeetingStatusBadge status={m.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/board/${m.id}`}
                        className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                        aria-label={`Open ${m.meeting_number}`}
                      >
                        Open
                      </Link>
                      <DeleteButton id={m.id} action={deleteBoardMeetingAction} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
