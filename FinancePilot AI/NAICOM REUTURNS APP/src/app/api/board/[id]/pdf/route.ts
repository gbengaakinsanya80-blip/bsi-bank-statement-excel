import { NextResponse } from "next/server";
import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { getMeeting } from "@/lib/services/board-service";
import { generateBoardMinutesPdf } from "@/lib/board/pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await requireAppUser();

  const supabase = await createServerSupabase();
  const meeting = await getMeeting(supabase, id);
  if (!meeting) {
    return NextResponse.json({ error: "Meeting not found." }, { status: 404 });
  }

  const bytes = await generateBoardMinutesPdf(meeting, { includeMinutes: true });

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${meeting.meeting_number.replace(/[^\w.-]+/g, "_")}.pdf"`,
    },
  });
}
