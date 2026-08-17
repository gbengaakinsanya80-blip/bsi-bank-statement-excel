import { z } from "zod";
import type { DbClient } from "@/lib/supabase/server";
import type { BoardMeeting } from "@/lib/board/types";
import { listDemoMeetings, upsertDemoMeeting, deleteDemoMeeting, getDemoMeeting } from "@/lib/demo/board-store";

export const meetingInputSchema = z.object({
  meeting_number: z.string().trim().max(100).optional(),
  meeting_type: z.enum(["Q1", "Q2", "Q3", "Q4", "AGM", "SPECIAL"]),
  quarter: z.coerce.number().int().min(1).max(4).nullable(),
  financial_year: z.coerce.number().int().min(2000).max(2100),
  meeting_date: z.string().date("Meeting date is required"),
  meeting_time: z.string().trim().max(50).nullable(),
  venue: z.string().trim().max(300).nullable(),
  chairman: z.string().trim().max(200).nullable(),
  secretary: z.string().trim().max(200).nullable(),
});

export type MeetingInput = z.output<typeof meetingInputSchema>;

export {
  attendeeInputSchema,
  agendaItemInputSchema,
  resolutionInputSchema,
  actionPointInputSchema,
  documentInputSchema,
  meetingNumberFor,
  newMeetingId,
  newChildId,
  meetingPeriodRange,
  setAttendees,
  addAttendee,
  updateAttendee,
  removeAttendee,
  setAgendaItems,
  addAgendaItem,
  removeAgendaItem,
  nextResolutionNumber,
  addResolution,
  updateResolution,
  removeResolution,
  addActionPoint,
  updateActionPoint,
  removeActionPoint,
  setMinutes,
  transitionStatus,
  addDocument,
  removeDocument,
  outstandingActionsFrom,
} from "@/lib/board/utils";

// ------------------------------------------------------------------
// Persistence (demo JSON store or Supabase)
// ------------------------------------------------------------------
export async function createMeeting(
  supabase: DbClient | null,
  meeting: BoardMeeting
): Promise<void> {
  if (!supabase) {
    await upsertDemoMeeting(meeting);
    return;
  }
  const { error } = await supabase.from("board_meetings").insert(toRow(meeting));
  if (error) throw new Error(error.message);
}

export async function persistMeeting(
  supabase: DbClient | null,
  meeting: BoardMeeting
): Promise<void> {
  if (!supabase) {
    await upsertDemoMeeting(meeting);
    return;
  }
  const { error } = await supabase
    .from("board_meetings")
    .update({ ...toRow(meeting), updated_at: new Date().toISOString() })
    .eq("id", meeting.id);
  if (error) throw new Error(error.message);
}

export async function removeMeeting(
  supabase: DbClient | null,
  id: string
): Promise<void> {
  if (!supabase) {
    await deleteDemoMeeting(id);
    return;
  }
  const { error } = await supabase
    .from("board_meetings")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function getMeeting(
  supabase: DbClient | null,
  id: string
): Promise<BoardMeeting | null> {
  if (!supabase) {
    return getDemoMeeting(id);
  }
  const { data, error } = await supabase
    .from("board_meetings")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? fromRow(data) : null;
}

export async function listMeetings(
  supabase: DbClient | null
): Promise<BoardMeeting[]> {
  if (!supabase) {
    return listDemoMeetings();
  }
  const { data, error } = await supabase
    .from("board_meetings")
    .select("*")
    .is("deleted_at", null)
    .order("meeting_date", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

// ------------------------------------------------------------------
// Row mapping
// ------------------------------------------------------------------
export function toRow(meeting: BoardMeeting): Record<string, unknown> {
  return {
    id: meeting.id,
    meeting_number: meeting.meeting_number,
    meeting_type: meeting.meeting_type,
    quarter: meeting.quarter,
    financial_year: meeting.financial_year,
    meeting_date: meeting.meeting_date,
    meeting_time: meeting.meeting_time,
    venue: meeting.venue,
    status: meeting.status,
    chairman: meeting.chairman,
    secretary: meeting.secretary,
    agenda: meeting.agenda,
    minutes: meeting.minutes,
    attendees: meeting.attendees,
    resolutions: meeting.resolutions,
    action_points: meeting.action_points,
    documents: meeting.documents,
    period_start: meeting.period_start,
    period_end: meeting.period_end,
    date_approved: meeting.date_approved,
    approved_by: meeting.approved_by,
    reopen_reason: meeting.reopen_reason,
    created_by: meeting.created_by,
    deleted_at: meeting.deleted_at,
    created_at: meeting.created_at,
    updated_at: meeting.updated_at,
  };
}

export function fromRow(row: Record<string, unknown>): BoardMeeting {
  return {
    id: String(row.id),
    meeting_number: String(row.meeting_number ?? ""),
    meeting_type: (row.meeting_type ?? "SPECIAL") as BoardMeeting["meeting_type"],
    quarter: row.quarter === null || row.quarter === undefined ? null : Number(row.quarter),
    financial_year: Number(row.financial_year ?? new Date().getFullYear()),
    meeting_date: String(row.meeting_date ?? ""),
    meeting_time: row.meeting_time === null || row.meeting_time === undefined ? null : String(row.meeting_time),
    venue: row.venue === null || row.venue === undefined ? null : String(row.venue),
    status: (row.status ?? "DRAFT") as BoardMeeting["status"],
    chairman: row.chairman === null || row.chairman === undefined ? null : String(row.chairman),
    secretary: row.secretary === null || row.secretary === undefined ? null : String(row.secretary),
    agenda: Array.isArray(row.agenda) ? (row.agenda as BoardMeeting["agenda"]) : [],
    minutes: String(row.minutes ?? ""),
    attendees: Array.isArray(row.attendees) ? (row.attendees as BoardMeeting["attendees"]) : [],
    resolutions: Array.isArray(row.resolutions) ? (row.resolutions as BoardMeeting["resolutions"]) : [],
    action_points: Array.isArray(row.action_points) ? (row.action_points as BoardMeeting["action_points"]) : [],
    documents: Array.isArray(row.documents) ? (row.documents as BoardMeeting["documents"]) : [],
    period_start: row.period_start === null || row.period_start === undefined ? null : String(row.period_start),
    period_end: row.period_end === null || row.period_end === undefined ? null : String(row.period_end),
    date_approved: row.date_approved === null || row.date_approved === undefined ? null : String(row.date_approved),
    approved_by: row.approved_by === null || row.approved_by === undefined ? null : String(row.approved_by),
    reopen_reason: row.reopen_reason === null || row.reopen_reason === undefined ? null : String(row.reopen_reason),
    created_by: row.created_by === null || row.created_by === undefined ? null : String(row.created_by),
    deleted_at: row.deleted_at === null || row.deleted_at === undefined ? null : String(row.deleted_at),
    created_at: String(row.created_at ?? new Date().toISOString()),
    updated_at: String(row.updated_at ?? new Date().toISOString()),
  };
}

export type { BoardActionPoint } from "@/lib/board/types";
