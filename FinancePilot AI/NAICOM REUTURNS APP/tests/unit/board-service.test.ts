import { describe, expect, it } from "vitest";
import type { BoardMeeting } from "@/lib/board/types";
import {
  addActionPoint,
  addAttendee,
  addDocument,
  addResolution,
  addAgendaItem,
  meetingNumberFor,
  meetingPeriodRange,
  newMeetingId,
  removeAgendaItem,
  removeAttendee,
  removeActionPoint,
  removeResolution,
  setAgendaItems,
  setMinutes,
  transitionStatus,
  updateActionPoint,
  updateAttendee,
  fromRow,
  toRow,
  nextResolutionNumber,
  outstandingActionsFrom,
} from "@/lib/services/board-service";

function makeMeeting(overrides: Partial<BoardMeeting> = {}): BoardMeeting {
  return {
    id: "board-1",
    meeting_number: "WMK-BRD/2026/Q2/001",
    meeting_type: "Q2",
    quarter: 2,
    financial_year: 2026,
    meeting_date: "2026-06-15",
    meeting_time: "10:00",
    venue: "Boardroom",
    status: "DRAFT",
    chairman: null,
    secretary: null,
    agenda: [],
    minutes: "",
    attendees: [],
    resolutions: [],
    action_points: [],
    documents: [],
    period_start: "2026-04-01",
    period_end: "2026-06-30",
    date_approved: null,
    approved_by: null,
    reopen_reason: null,
    created_by: null,
    deleted_at: null,
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-01T08:00:00.000Z",
    ...overrides,
  };
}

describe("board service helpers", () => {
  it("generates sequential meeting numbers", () => {
    expect(meetingNumberFor(2026, "Q2", 0)).toBe("WMK-BRD/2026/Q2/001");
    expect(meetingNumberFor(2026, "Q2", 12)).toBe("WMK-BRD/2026/Q2/013");
  });

  it("generates unique meeting and child ids", () => {
    expect(newMeetingId()).toMatch(/^board-[0-9a-f-]{36}$/);
    expect(newMeetingId()).not.toBe(newMeetingId());
  });

  it("links quarterly meetings to their reporting period range", () => {
    expect(meetingPeriodRange(2026, 1)).toEqual({ period_start: "2026-01-01", period_end: "2026-03-31" });
    expect(meetingPeriodRange(2026, 4)).toEqual({ period_start: "2026-10-01", period_end: "2026-12-31" });
    expect(meetingPeriodRange(2026, null)).toEqual({ period_start: null, period_end: null });
    expect(meetingPeriodRange(2026, 0)).toEqual({ period_start: null, period_end: null });
  });

  it("computes the next resolution number", () => {
    const m = makeMeeting({
      resolutions: [
        { id: "r1", resolution_number: 1, agenda_item: null, resolution: "A", responsible_person: null, due_date: null, status: "OPEN", remarks: null },
        { id: "r2", resolution_number: 3, agenda_item: null, resolution: "B", responsible_person: null, due_date: null, status: "OPEN", remarks: null },
      ],
    });
    expect(nextResolutionNumber(m)).toBe(4);
  });
});

describe("board meeting operations", () => {
  it("adds and removes attendees", () => {
    let m = makeMeeting();
    m = addAttendee(m, { name: "Adaeze Okafor", designation: "Managing Director", presence: "PRESENT" });
    expect(m.attendees).toHaveLength(1);
    m = updateAttendee(m, m.attendees[0].id, { name: "Adaeze Okafor", designation: "CEO", presence: "APOLOGY" });
    expect(m.attendees[0].designation).toBe("CEO");
    expect(m.attendees[0].presence).toBe("APOLOGY");
    m = removeAttendee(m, m.attendees[0].id);
    expect(m.attendees).toHaveLength(0);
  });

  it("keeps agenda ordering sequential when items are removed", () => {
    let m = makeMeeting();
    m = setAgendaItems(m, [
      { id: "a1", order: 1, title: "Opening" },
      { id: "a2", order: 2, title: "Matters arising" },
      { id: "a3", order: 3, title: "Any other business" },
    ]);
    m = removeAgendaItem(m, "a2");
    expect(m.agenda.map((a) => a.order)).toEqual([1, 2]);
    m = addAgendaItem(m, { order: 99, title: "Closing" });
    expect(m.agenda.at(-1)?.order).toBe(3);
  });

  it("numbers resolutions sequentially", () => {
    let m = makeMeeting();
    m = addResolution(m, { agenda_item: "Financial performance", resolution: "The Board approved the accounts.", responsible_person: "Funke Adeyemi", due_date: "2026-07-01", status: "OPEN", remarks: null });
    m = addResolution(m, { agenda_item: null, resolution: "The Board resolved to appoint auditors.", responsible_person: null, due_date: null, status: "COMPLETED", remarks: "Done" });
    expect(m.resolutions.map((r) => r.resolution_number)).toEqual([1, 2]);
    m = removeResolution(m, m.resolutions[0].id);
    expect(m.resolutions).toHaveLength(1);
    expect(nextResolutionNumber(m)).toBe(3);
  });

  it("adds, updates status and removes action points", () => {
    let m = makeMeeting();
    m = addActionPoint(m, { action: "Circulate NAICOM tracker", responsible_person: "Emeka Obi", due_date: "2026-07-10", status: "OPEN", remarks: null });
    const id = m.action_points[0].id;
    m = updateActionPoint(m, id, { action: "Circulate NAICOM tracker", responsible_person: "Emeka Obi", due_date: "2026-07-10", status: "IN_PROGRESS", remarks: "On track" });
    expect(m.action_points[0].status).toBe("IN_PROGRESS");
    expect(m.action_points[0].remarks).toBe("On track");
    m = removeActionPoint(m, id);
    expect(m.action_points).toHaveLength(0);
  });

  it("saves the minutes HTML body", () => {
    const m = setMinutes(makeMeeting(), "<p>Minutes…</p>");
    expect(m.minutes).toBe("<p>Minutes…</p>");
  });

  it("adds document metadata", () => {
    const m = addDocument(makeMeeting(), { name: "Signed minutes.pdf", category: "SIGNED_MINUTES", path: null }, { uploadedBy: "user-1" });
    expect(m.documents).toHaveLength(1);
    expect(m.documents[0].category).toBe("SIGNED_MINUTES");
    expect(m.documents[0].uploaded_by).toBe("user-1");
    expect(m.documents[0].uploaded_at).toBeTruthy();
  });

  it("finds outstanding action points across other meetings", () => {
    const m1 = makeMeeting({
      action_points: [
        { id: "ap1", action: "Do A", responsible_person: null, due_date: null, status: "OPEN", remarks: null },
      ],
    });
    const m2 = makeMeeting({
      id: "board-2",
      action_points: [
        { id: "ap2", action: "Do B", responsible_person: null, due_date: null, status: "COMPLETED", remarks: null },
      ],
    });
    const outstanding = outstandingActionsFrom([m1, m2], "board-3");
    expect(outstanding).toHaveLength(1);
    expect(outstanding[0].remarks).toContain("WMK-BRD/2026/Q2/001");
  });
});

describe("board workflow transitions", () => {
  it("moves DRAFT to REVIEW and REVIEW back to DRAFT", () => {
    let m = makeMeeting();
    m = transitionStatus(m, "REVIEW", { userId: "u1" });
    expect(m.status).toBe("REVIEW");
    m = transitionStatus(m, "DRAFT", { userId: "u1" });
    expect(m.status).toBe("DRAFT");
  });

  it("sets approval metadata when moving to APPROVED", () => {
    let m = makeMeeting({ status: "REVIEW" });
    m = transitionStatus(m, "APPROVED", { userId: "u-admin" });
    expect(m.status).toBe("APPROVED");
    expect(m.date_approved).toBeTruthy();
    expect(m.approved_by).toBe("u-admin");
  });

  it("finalizes from APPROVED and clears approval on reopen", () => {
    let m = makeMeeting({ status: "APPROVED", date_approved: "2026-07-01T00:00:00.000Z", approved_by: "u-admin" });
    m = transitionStatus(m, "FINAL", { userId: "u-admin" });
    expect(m.status).toBe("FINAL");
    m = transitionStatus(m, "REVIEW", { userId: "u-admin", reason: "Typo in section 3" });
    expect(m.status).toBe("REVIEW");
    expect(m.date_approved).toBeNull();
    expect(m.reopen_reason).toBe("Typo in section 3");
  });

  it("rejects invalid transitions", () => {
    expect(() => transitionStatus(makeMeeting({ status: "DRAFT" }), "FINAL", { userId: "u1" })).toThrow();
    expect(() => transitionStatus(makeMeeting({ status: "CANCELLED" }), "REVIEW", { userId: "u1" })).toThrow();
  });
});

describe("board row mapping", () => {
  it("round-trips through the row shape", () => {
    const m = makeMeeting({
      attendees: [{ id: "at1", name: "Adaeze Okafor", designation: "Managing Director", presence: "PRESENT" }],
      resolutions: [{ id: "r1", resolution_number: 1, agenda_item: null, resolution: "Approve accounts", responsible_person: null, due_date: null, status: "OPEN", remarks: null }],
      documents: [{ id: "d1", name: "Board paper.pdf", category: "BOARD_PAPERS", path: null, uploaded_by: "u1", uploaded_at: "2026-06-01T00:00:00.000Z" }],
    });
    const restored = fromRow(toRow(m) as Record<string, unknown>);
    expect(restored.id).toBe(m.id);
    expect(restored.meeting_number).toBe(m.meeting_number);
    expect(restored.status).toBe(m.status);
    expect(restored.attendees).toEqual(m.attendees);
    expect(restored.resolutions).toEqual(m.resolutions);
    expect(restored.documents).toEqual(m.documents);
    expect(restored.period_start).toBe("2026-04-01");
  });
});
