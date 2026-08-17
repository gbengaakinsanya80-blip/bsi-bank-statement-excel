"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import type { BoardMeeting } from "@/lib/board/types";
import { isBoardEditLocked } from "@/lib/board/types";
import { minutesTemplateHtml, buildMinutesFormHtml, type MinutesAgendaRow } from "@/lib/board/template";
import {
  addActionPoint,
  addAttendee,
  addDocument,
  addResolution,
  createMeeting,
  getMeeting,
  meetingInputSchema,
  meetingNumberFor,
  meetingPeriodRange,
  newMeetingId,
  persistMeeting,
  removeActionPoint,
  removeAttendee,
  removeDocument,
  removeMeeting,
  removeResolution,
  setAgendaItems,
  setMinutes,
  transitionStatus,
  updateActionPoint,
  updateAttendee,
} from "@/lib/services/board-service";
import { recordAudit } from "@/lib/services/audit-service";

export type BoardActionState = { error?: string; fieldErrors?: Record<string, string[]> } | null;

function nullable(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

async function audit(
  action: string,
  recordId: string | null,
  oldValue: unknown,
  newValue: unknown
) {
  const session = await requireAppUser();
  const supabase = await createServerSupabase();
  await recordAudit(
    supabase,
    {
      action,
      module: "BOARD_MEETINGS",
      recordId,
      oldValue,
      newValue,
    },
    session.id
  );
}

function parseMeetingInput(formData: FormData) {
  return meetingInputSchema.safeParse({
    meeting_number: formData.get("meeting_number"),
    meeting_type: formData.get("meeting_type"),
    quarter: nullable(formData.get("quarter")),
    financial_year: nullable(formData.get("financial_year")),
    meeting_date: formData.get("meeting_date"),
    meeting_time: nullable(formData.get("meeting_time")),
    venue: nullable(formData.get("venue")),
    chairman: nullable(formData.get("chairman")),
    secretary: nullable(formData.get("secretary")),
  });
}

export async function createBoardMeetingAction(
  _prevState: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  const session = await requireAppUser();

  const parsed = parseMeetingInput(formData);
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const d = parsed.data;
  const supabase = await createServerSupabase();
  const { period_start, period_end } = meetingPeriodRange(d.financial_year, d.quarter);
  const now = new Date().toISOString();

  let meetingNumber = d.meeting_number;
  if (!meetingNumber) {
    const count = supabase ? 0 : (await listForCount()).length;
    meetingNumber = meetingNumberFor(d.financial_year, d.meeting_type, count);
  }

  const meeting: BoardMeeting = {
    id: newMeetingId(),
    meeting_number: meetingNumber,
    meeting_type: d.meeting_type,
    quarter: d.quarter ?? null,
    financial_year: d.financial_year,
    meeting_date: d.meeting_date,
    meeting_time: d.meeting_time,
    venue: d.venue,
    status: "DRAFT",
    chairman: d.chairman,
    secretary: d.secretary,
    agenda: [],
    minutes: minutesTemplateHtml({ ...d, meeting_number: meetingNumber }),
    attendees: [],
    resolutions: [],
    action_points: [],
    documents: [],
    period_start,
    period_end,
    date_approved: null,
    approved_by: null,
    reopen_reason: null,
    created_by: session.id,
    deleted_at: null,
    created_at: now,
    updated_at: now,
  };

  await createMeeting(supabase, meeting);
  await audit("CREATE_MEETING", meeting.id, null, { meeting_number: meeting.meeting_number });

  redirect(`/board/${meeting.id}`);
}

async function listForCount(): Promise<BoardMeeting[]> {
  const { listDemoMeetings } = await import("@/lib/demo/board-store");
  return listDemoMeetings();
}

export async function updateBoardMeetingAction(
  _prevState: BoardActionState,
  formData: FormData
): Promise<BoardActionState> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing meeting id." };

  const parsed = parseMeetingInput(formData);
  if (!parsed.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createServerSupabase();
  const meeting = await getMeeting(supabase, id);
  if (!meeting) return { error: "Meeting not found." };
  if (isBoardEditLocked(meeting.status)) return { error: "Final minutes cannot be edited." };

  const d = parsed.data;
  const { period_start, period_end } = meetingPeriodRange(d.financial_year, d.quarter);
  const previous = { ...meeting };

  const updated: BoardMeeting = {
    ...meeting,
    meeting_number: d.meeting_number ?? meeting.meeting_number,
    meeting_type: d.meeting_type,
    quarter: d.quarter ?? null,
    financial_year: d.financial_year,
    meeting_date: d.meeting_date,
    meeting_time: d.meeting_time,
    venue: d.venue,
    chairman: d.chairman,
    secretary: d.secretary,
    period_start,
    period_end,
    updated_at: new Date().toISOString(),
  };

  await persistMeeting(supabase, updated);
  await audit("UPDATE_MEETING", meeting.id, previous, updated);
  redirect(`/board/${meeting.id}`);
}

export async function deleteBoardMeetingAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createServerSupabase();
  await removeMeeting(supabase, id);
  await audit("DELETE_MEETING", id, null, null);
  redirect("/board");
}

async function loadForEdit(supabase: Awaited<ReturnType<typeof createServerSupabase>>, id: string) {
  const meeting = await getMeeting(supabase, id);
  if (!meeting) redirect("/board");
  if (isBoardEditLocked(meeting.status)) redirect(`/board/${id}`);
  return meeting;
}

async function persistAudit(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  meeting: BoardMeeting,
  action: string,
  oldValue: unknown,
  newValue: unknown
) {
  await persistMeeting(supabase, meeting);
  await audit(action, meeting.id, oldValue, newValue);
  revalidatePath(`/board/${meeting.id}`);
}

export async function saveMinutesAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const html = String(formData.get("minutes") ?? "");
  if (!id) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = setMinutes(meeting, html);
  await persistAudit(supabase, updated, "SAVE_MINUTES", null, { length: html.length });
}

export async function generateMinutesAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  let agenda: MinutesAgendaRow[] = [];
  try {
    const raw = JSON.parse(String(formData.get("agenda") ?? "[]")) as unknown;
    agenda = Array.isArray(raw)
      ? raw.map((a) => ({
          title: String((a as { title?: unknown })?.title ?? ""),
          deliberation: String((a as { deliberation?: unknown })?.deliberation ?? ""),
        }))
      : [];
  } catch {
    agenda = [];
  }

  const lines = (key: string) =>
    String(formData.get(key) ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  const values = {
    openingPrayer: String(formData.get("opening_prayer") ?? "").trim(),
    present: lines("present"),
    apologies: lines("apologies"),
    absent: lines("absent"),
    inAttendance: lines("in_attendance"),
    agenda,
    adjournment: String(formData.get("adjournment") ?? "").trim(),
  };

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);

  const agendaItems = agenda
    .map((item) => item.title.trim())
    .filter(Boolean)
    .map((title, i) => ({ id: randomUUID(), order: i + 1, title: title.slice(0, 500) }));
  const withAgenda = setAgendaItems(meeting, agendaItems);

  const html = buildMinutesFormHtml(withAgenda, values);
  const updated = setMinutes(withAgenda, html);
  await persistAudit(supabase, updated, "GENERATE_MINUTES", null, {
    length: html.length,
    agendaCount: agendaItems.length,
  });
}

export async function saveAgendaAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("agenda") ?? "");
  if (!id) return;

  const items = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((title, i) => ({ id: randomUUID(), order: i + 1, title: title.slice(0, 500) }));

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = setAgendaItems(meeting, items);
  await persistAudit(supabase, updated, "SAVE_AGENDA", null, { count: items.length });
}

export async function addAttendeeAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const designation = nullable(formData.get("designation"));
  const presence = String(formData.get("presence") ?? "PRESENT");
  if (!id || !name) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = addAttendee(meeting, { name, designation, presence: presence as never });
  await persistAudit(supabase, updated, "ADD_ATTENDEE", null, { name });
}

export async function updateAttendeeAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const attendeeId = String(formData.get("attendee_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const designation = nullable(formData.get("designation"));
  const presence = String(formData.get("presence") ?? "PRESENT");
  if (!id || !attendeeId || !name) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = updateAttendee(meeting, attendeeId, { name, designation, presence: presence as never });
  await persistAudit(supabase, updated, "UPDATE_ATTENDEE", null, { name });
}

export async function removeAttendeeAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const attendeeId = String(formData.get("attendee_id") ?? "");
  if (!id || !attendeeId) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = removeAttendee(meeting, attendeeId);
  await persistAudit(supabase, updated, "REMOVE_ATTENDEE", null, null);
}

export async function addResolutionAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const resolution = String(formData.get("resolution") ?? "").trim();
  if (!id || !resolution) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = addResolution(meeting, {
    agenda_item: nullable(formData.get("agenda_item")),
    resolution,
    responsible_person: nullable(formData.get("responsible_person")),
    due_date: nullable(formData.get("due_date")),
    status: (String(formData.get("status") ?? "OPEN") || "OPEN") as "OPEN",
    remarks: nullable(formData.get("remarks")),
  });
  await persistAudit(supabase, updated, "ADD_RESOLUTION", null, null);
}

export async function removeResolutionAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const resolutionId = String(formData.get("resolution_id") ?? "");
  if (!id || !resolutionId) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = removeResolution(meeting, resolutionId);
  await persistAudit(supabase, updated, "REMOVE_RESOLUTION", null, null);
}

export async function addActionPointAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "").trim();
  if (!id || !action) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = addActionPoint(meeting, {
    action,
    responsible_person: nullable(formData.get("responsible_person")),
    due_date: nullable(formData.get("due_date")),
    status: (String(formData.get("status") ?? "OPEN") || "OPEN") as "OPEN",
    remarks: nullable(formData.get("remarks")),
  });
  await persistAudit(supabase, updated, "ADD_ACTION_POINT", null, null);
}

export async function updateActionPointStatusAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const actionId = String(formData.get("action_id") ?? "");
  const status = String(formData.get("status") ?? "OPEN");
  if (!id || !actionId) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const target = meeting.action_points.find((a) => a.id === actionId);
  if (!target) return;
  const updated = updateActionPoint(meeting, actionId, {
    action: target.action,
    responsible_person: target.responsible_person,
    due_date: target.due_date,
    status: status as never,
    remarks: target.remarks,
  });
  await persistAudit(supabase, updated, "UPDATE_ACTION_STATUS", null, { status });
}

export async function removeActionPointAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const actionId = String(formData.get("action_id") ?? "");
  if (!id || !actionId) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = removeActionPoint(meeting, actionId);
  await persistAudit(supabase, updated, "REMOVE_ACTION_POINT", null, null);
}

export async function addDocumentAction(formData: FormData): Promise<void> {
  const session = await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = addDocument(
    meeting,
    {
      name,
      category: String(formData.get("category") ?? "SUPPORTING_DOCUMENT"),
      path: nullable(formData.get("path")),
    },
    { uploadedBy: session.id }
  );
  await persistAudit(supabase, updated, "ADD_DOCUMENT", null, { name });
}

export async function removeDocumentAction(formData: FormData): Promise<void> {
  await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  if (!id || !documentId) return;

  const supabase = await createServerSupabase();
  const meeting = await loadForEdit(supabase, id);
  const updated = removeDocument(meeting, documentId);
  await persistAudit(supabase, updated, "REMOVE_DOCUMENT", null, null);
}

const APPROVE_ACTIONS: Record<string, boolean> = { APPROVED: true, FINAL: true };

export async function transitionStatusAction(formData: FormData): Promise<{ error?: string } | void> {
  const session = await requireAppUser();
  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("status") ?? "");
  const reason = nullable(formData.get("reason"));
  if (!id || !next) return;

  if (APPROVE_ACTIONS[next]) {
    const canApprove = await canApproveAction(session.id);
    if (!canApprove) return { error: "Only an administrator can approve or finalize minutes." };
  }

  const supabase = await createServerSupabase();
  const meeting = await getMeeting(supabase, id);
  if (!meeting) return { error: "Meeting not found." };

  try {
    const updated = transitionStatus(meeting, next as BoardMeeting["status"], {
      userId: session.id,
      reason,
    });
    await persistMeeting(supabase, updated);
    await audit("TRANSITION_STATUS", meeting.id, meeting.status, next);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Invalid status change." };
  }
  revalidatePath(`/board/${id}`);
}

async function canApproveAction(userId: string): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return true;
  const { data } = await supabase.from("users").select("role").eq("id", userId).single();
  return data?.role === "SUPER_ADMIN" || data?.role === "ADMIN";
}
