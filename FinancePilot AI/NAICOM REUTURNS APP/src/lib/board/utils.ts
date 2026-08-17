import { z } from "zod";
import type {
  BoardAgendaItem,
  BoardAttendee,
  BoardMeeting,
  BoardResolution,
  BoardActionPoint,
  BoardDocument,
  MeetingStatus,
} from "@/lib/board/types";
import {
  ACTION_STATUSES,
  ATTENDANCE_TYPES,
  MEETING_STATUS_TRANSITIONS,
  RESOLUTION_STATUSES,
} from "@/lib/board/types";
import { quarterlyPeriod } from "@/lib/returns/periods";

export const attendeeInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  designation: z.string().trim().max(200).nullable(),
  presence: z.enum(ATTENDANCE_TYPES).default("PRESENT"),
});

export const agendaItemInputSchema = z.object({
  order: z.coerce.number().int().min(1),
  title: z.string().trim().min(1, "Agenda title is required").max(500),
});

export const resolutionInputSchema = z.object({
  agenda_item: z.string().trim().max(500).nullable(),
  resolution: z.string().trim().min(1, "Resolution text is required").max(4000),
  responsible_person: z.string().trim().max(200).nullable(),
  due_date: z.string().date().nullable(),
  status: z.enum(RESOLUTION_STATUSES).default("OPEN"),
  remarks: z.string().trim().max(500).nullable(),
});

export const actionPointInputSchema = z.object({
  action: z.string().trim().min(1, "Action is required").max(2000),
  responsible_person: z.string().trim().max(200).nullable(),
  due_date: z.string().date().nullable(),
  status: z.enum(ACTION_STATUSES).default("OPEN"),
  remarks: z.string().trim().max(500).nullable(),
});

export const documentInputSchema = z.object({
  name: z.string().trim().min(1, "Document name is required").max(300),
  category: z.string().trim().max(100).default("SUPPORTING_DOCUMENT"),
  path: z.string().trim().max(1000).nullable(),
});

/** Cross-runtime (Node + browser) id generator. */
export function uid(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newMeetingId(): string {
  return `board-${uid()}`;
}

export function newChildId(): string {
  return uid();
}

/** Default meeting number like WMK-BRD/2026/Q2/001. */
export function meetingNumberFor(
  year: number,
  type: string,
  existingCount: number
): string {
  const seq = String(existingCount + 1).padStart(3, "0");
  return `WMK-BRD/${year}/${type}/${seq}`;
}

/** Reporting-period range a quarterly meeting links to (nil for AGM/special). */
export function meetingPeriodRange(
  financialYear: number,
  quarter: number | null
): { period_start: string | null; period_end: string | null } {
  if (!quarter || quarter < 1 || quarter > 4) return { period_start: null, period_end: null };
  const period = quarterlyPeriod(financialYear, quarter);
  return { period_start: period.start, period_end: period.end };
}

// ------------------------------------------------------------------
// Pure meeting operations (shared by server actions and UI defaults)
// ------------------------------------------------------------------
export function setAttendees(meeting: BoardMeeting, attendees: BoardAttendee[]): BoardMeeting {
  return { ...meeting, attendees };
}

export function addAttendee(
  meeting: BoardMeeting,
  input: z.infer<typeof attendeeInputSchema>
): BoardMeeting {
  const attendee: BoardAttendee = {
    id: uid(),
    name: input.name,
    designation: input.designation ?? null,
    presence: input.presence,
  };
  return { ...meeting, attendees: [...meeting.attendees, attendee] };
}

export function updateAttendee(
  meeting: BoardMeeting,
  id: string,
  input: z.infer<typeof attendeeInputSchema>
): BoardMeeting {
  return {
    ...meeting,
    attendees: meeting.attendees.map((a) =>
      a.id === id
        ? { ...a, name: input.name, designation: input.designation ?? null, presence: input.presence }
        : a
    ),
  };
}

export function removeAttendee(meeting: BoardMeeting, id: string): BoardMeeting {
  return { ...meeting, attendees: meeting.attendees.filter((a) => a.id !== id) };
}

export function setAgendaItems(meeting: BoardMeeting, items: BoardAgendaItem[]): BoardMeeting {
  return { ...meeting, agenda: items };
}

export function addAgendaItem(
  meeting: BoardMeeting,
  input: z.infer<typeof agendaItemInputSchema>
): BoardMeeting {
  const order = meeting.agenda.reduce((max, a) => Math.max(max, a.order), 0) + 1;
  const item: BoardAgendaItem = { id: uid(), order, title: input.title };
  return { ...meeting, agenda: [...meeting.agenda, item] };
}

export function removeAgendaItem(meeting: BoardMeeting, id: string): BoardMeeting {
  return {
    ...meeting,
    agenda: meeting.agenda
      .filter((a) => a.id !== id)
      .map((a, i) => ({ ...a, order: i + 1 })),
  };
}

export function nextResolutionNumber(meeting: BoardMeeting): number {
  return meeting.resolutions.reduce((max, r) => Math.max(max, r.resolution_number), 0) + 1;
}

export function addResolution(
  meeting: BoardMeeting,
  input: z.infer<typeof resolutionInputSchema>
): BoardMeeting {
  const resolution: BoardResolution = {
    id: uid(),
    resolution_number: nextResolutionNumber(meeting),
    agenda_item: input.agenda_item ?? null,
    resolution: input.resolution,
    responsible_person: input.responsible_person ?? null,
    due_date: input.due_date ?? null,
    status: input.status,
    remarks: input.remarks ?? null,
  };
  return { ...meeting, resolutions: [...meeting.resolutions, resolution] };
}

export function updateResolution(
  meeting: BoardMeeting,
  id: string,
  input: z.infer<typeof resolutionInputSchema>
): BoardMeeting {
  return {
    ...meeting,
    resolutions: meeting.resolutions.map((r) =>
      r.id === id
        ? {
            ...r,
            agenda_item: input.agenda_item ?? null,
            resolution: input.resolution,
            responsible_person: input.responsible_person ?? null,
            due_date: input.due_date ?? null,
            status: input.status,
            remarks: input.remarks ?? null,
          }
        : r
    ),
  };
}

export function removeResolution(meeting: BoardMeeting, id: string): BoardMeeting {
  return { ...meeting, resolutions: meeting.resolutions.filter((r) => r.id !== id) };
}

export function addActionPoint(
  meeting: BoardMeeting,
  input: z.infer<typeof actionPointInputSchema>
): BoardMeeting {
  const action: BoardActionPoint = {
    id: uid(),
    action: input.action,
    responsible_person: input.responsible_person ?? null,
    due_date: input.due_date ?? null,
    status: input.status,
    remarks: input.remarks ?? null,
  };
  return { ...meeting, action_points: [...meeting.action_points, action] };
}

export function updateActionPoint(
  meeting: BoardMeeting,
  id: string,
  input: z.infer<typeof actionPointInputSchema>
): BoardMeeting {
  return {
    ...meeting,
    action_points: meeting.action_points.map((a) =>
      a.id === id
        ? {
            ...a,
            action: input.action,
            responsible_person: input.responsible_person ?? null,
            due_date: input.due_date ?? null,
            status: input.status,
            remarks: input.remarks ?? null,
          }
        : a
    ),
  };
}

export function removeActionPoint(meeting: BoardMeeting, id: string): BoardMeeting {
  return { ...meeting, action_points: meeting.action_points.filter((a) => a.id !== id) };
}

export function setMinutes(meeting: BoardMeeting, html: string): BoardMeeting {
  return { ...meeting, minutes: html };
}

export function transitionStatus(
  meeting: BoardMeeting,
  next: MeetingStatus,
  opts: { userId: string | null; reason?: string | null }
): BoardMeeting {
  const allowed = MEETING_STATUS_TRANSITIONS[meeting.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Cannot move minutes from "${meeting.status}" to "${next}".`);
  }
  const update: Partial<BoardMeeting> = { status: next, reopen_reason: null };
  if (next === "APPROVED") {
    update.date_approved = new Date().toISOString();
    update.approved_by = opts.userId;
  }
  if (next === "REVIEW" || next === "DRAFT") {
    update.date_approved = null;
    update.approved_by = null;
  }
  if (next === "REVIEW" && opts.reason) update.reopen_reason = opts.reason;
  return { ...meeting, ...update };
}

export function addDocument(
  meeting: BoardMeeting,
  input: z.infer<typeof documentInputSchema>,
  opts: { uploadedBy: string | null }
): BoardMeeting {
  const document: BoardDocument = {
    id: uid(),
    name: input.name,
    category: input.category,
    path: input.path ?? null,
    uploaded_by: opts.uploadedBy,
    uploaded_at: new Date().toISOString(),
  };
  return { ...meeting, documents: [...meeting.documents, document] };
}

export function removeDocument(meeting: BoardMeeting, id: string): BoardMeeting {
  return { ...meeting, documents: meeting.documents.filter((d) => d.id !== id) };
}

/** Outstanding action points from other meetings (for the next meeting display). */
export function outstandingActionsFrom(
  meetings: BoardMeeting[],
  excludeId: string | null
): BoardActionPoint[] {
  return meetings
    .filter((m) => m.id !== excludeId)
    .flatMap((m) =>
      m.action_points
        .filter((a) => a.status === "OPEN" || a.status === "IN_PROGRESS")
        .map((a) => ({ ...a, remarks: a.remarks ?? `From ${m.meeting_number}` }))
    )
    .sort((a, b) => (a.due_date ?? "9999-12-31").localeCompare(b.due_date ?? "9999-12-31"));
}
