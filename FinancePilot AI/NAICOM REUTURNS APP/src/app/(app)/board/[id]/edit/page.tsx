import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MeetingForm } from "@/components/board/meeting-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMeeting } from "@/lib/services/board-service";
import { isBoardEditLocked } from "@/lib/board/types";
import { requireAppUser } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "Edit Board Meeting" };

export default async function EditMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAppUser();
  const supabase = await createServerSupabase();
  const meeting = await getMeeting(supabase, id);
  if (!meeting) notFound();
  if (isBoardEditLocked(meeting.status)) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Edit meeting details</h1>
        <p className="text-sm text-muted-foreground">Update the core details of the meeting record.</p>
      </div>
      <MeetingForm meeting={meeting} demo={!supabase} />
    </div>
  );
}
