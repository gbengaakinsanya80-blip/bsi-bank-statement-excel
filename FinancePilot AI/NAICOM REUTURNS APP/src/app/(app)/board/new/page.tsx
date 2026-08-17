import type { Metadata } from "next";
import { MeetingForm } from "@/components/board/meeting-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { listMeetings } from "@/lib/services/board-service";
import { requireAppUser } from "@/lib/auth/guard";

export const metadata: Metadata = { title: "New Board Meeting" };

export default async function NewMeetingPage() {
  await requireAppUser();
  const supabase = await createServerSupabase();
  const meetings = await listMeetings(supabase);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register a new board meeting</h1>
        <p className="text-sm text-muted-foreground">
          Create the meeting record. Minutes, attendance and resolutions are added after creation.
        </p>
      </div>
      <MeetingForm demo={!supabase} existingCount={meetings.length} />
    </div>
  );
}
