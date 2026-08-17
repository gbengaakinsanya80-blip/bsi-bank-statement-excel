import { describe, expect, it } from "vitest";
import {
  buildMinutesFormHtml,
  minutesTemplateHtml,
  meetingTypeName,
  parseMinutesFormValues,
  DEFAULT_AGENDA,
} from "@/lib/board/template";
import {
  ACTION_STATUSES,
  ATTENDANCE_TYPES,
  BOARD_MEETING_TYPES,
  isBoardEditLocked,
  MEETING_STATUS_TRANSITIONS,
  MEETING_STATUSES,
  RESOLUTION_STATUSES,
} from "@/lib/board/types";

describe("board types", () => {
  it("defines the quarterly and special meeting types", () => {
    expect(BOARD_MEETING_TYPES).toEqual(["Q1", "Q2", "Q3", "Q4", "AGM", "SPECIAL"]);
  });

  it("defines the minutes workflow statuses", () => {
    expect(MEETING_STATUSES).toContain("DRAFT");
    expect(MEETING_STATUSES).toContain("FINAL");
    expect(MEETING_STATUSES).toContain("CANCELLED");
  });

  it("only allows DRAFT -> REVIEW forward movement", () => {
    expect(MEETING_STATUS_TRANSITIONS.DRAFT).toEqual(["REVIEW"]);
  });

  it("locks editing only for FINAL minutes", () => {
    expect(isBoardEditLocked("FINAL")).toBe(true);
    for (const s of MEETING_STATUSES.filter((s) => s !== "FINAL")) {
      expect(isBoardEditLocked(s)).toBe(false);
    }
  });

  it("declares the attendance, resolution and action statuses", () => {
    expect(ATTENDANCE_TYPES).toContain("PRESENT");
    expect(RESOLUTION_STATUSES).toContain("COMPLETED");
    expect(ACTION_STATUSES).toContain("IN_PROGRESS");
  });
});

describe("board template", () => {
  it("maps meeting type names", () => {
    expect(meetingTypeName("Q2")).toBe("Q2 Board Meeting");
    expect(meetingTypeName("AGM")).toBe("Annual General/Board Meeting");
    expect(meetingTypeName("SPECIAL")).toBe("Special Board Meeting");
  });

  it("seeds the minutes body with company, title and default agenda", () => {
    const html = minutesTemplateHtml({
      meeting_number: "WMK-BRD/2026/Q2/001",
      meeting_type: "Q2",
      quarter: 2,
      financial_year: 2026,
      meeting_date: "2026-06-15",
      meeting_time: "10:00",
      venue: "Boardroom",
    });
    expect(html).toContain("WORLDMARK INSURANCE BROKERS LIMITED");
    expect(html).toContain("MINUTES OF BOARD OF DIRECTORS MEETING");
    expect(html).toContain("Q2 Board Meeting");
    expect(html).toContain("WMK-BRD/2026/Q2/001");
    expect(html).toContain("AGENDA");
    for (const item of DEFAULT_AGENDA) expect(html).toContain(item);
  });
});

describe("board minutes form", () => {
  const meeting = {
    meeting_number: "WMK-BRD/2026/Q2/001",
    meeting_type: "Q2",
    quarter: 2,
    financial_year: 2026,
    meeting_date: "2026-06-15",
    meeting_time: "10:00",
    venue: "Boardroom",
    chairman: "Chief Mrs. Ngozi Okonkwo",
    secretary: "Emeka Obi",
  };

  it("builds minutes that include the opening prayer, attendance and deliberations", () => {
    const html = buildMinutesFormHtml(meeting, {
      openingPrayer: "Mr. Sola",
      present: ["Chief Mrs. Ngozi Okonkwo", "Barr. Adewale Balogun"],
      apologies: ["Dr. Ibrahim Suleiman"],
      absent: [],
      inAttendance: ["Funke Adeyemi"],
      agenda: [
        { title: "Opening", deliberation: "The meeting was called to order." },
        { title: "Financial performance", deliberation: "Reviewed Q1 results." },
      ],
      adjournment: "The meeting was adjourned at 12:30pm.",
    });
    expect(html).toContain("WORLDMARK INSURANCE BROKERS LIMITED");
    expect(html).toContain("<h3>OPENING</h3>");
    expect(html).toContain("said by Mr. Sola");
    expect(html).toContain("<h3>PRESENT</h3>");
    expect(html).toContain("<li>Chief Mrs. Ngozi Okonkwo</li>");
    expect(html).toContain("<h3>AGENDA</h3>");
    expect(html).toContain("<strong>1. Opening</strong>");
    expect(html).toContain("The meeting was called to order.");
    expect(html).toContain("The meeting was adjourned at 12:30pm.");
  });

  it("round-trips form values back into the form", () => {
    const values = {
      openingPrayer: "Mr. Sola",
      present: ["Chief Mrs. Ngozi Okonkwo"],
      apologies: ["Dr. Ibrahim Suleiman"],
      absent: [] as string[],
      inAttendance: ["Funke Adeyemi"],
      agenda: [
        { title: "Opening", deliberation: "Line one\nLine two" },
        { title: "Financial performance", deliberation: "Reviewed results." },
      ],
      adjournment: "Adjourned at 12:30pm.",
    };
    const html = buildMinutesFormHtml(meeting, values);
    const parsed = parseMinutesFormValues(html);
    expect(parsed).not.toBeNull();
    expect(parsed!.openingPrayer).toBe("Mr. Sola");
    expect(parsed!.present).toEqual(["Chief Mrs. Ngozi Okonkwo"]);
    expect(parsed!.apologies).toEqual(["Dr. Ibrahim Suleiman"]);
    expect(parsed!.absent).toEqual([]);
    expect(parsed!.inAttendance).toEqual(["Funke Adeyemi"]);
    expect(parsed!.agenda).toEqual([
      { title: "Opening", deliberation: "Line one\nLine two" },
      { title: "Financial performance", deliberation: "Reviewed results." },
    ]);
    expect(parsed!.adjournment).toBe("Adjourned at 12:30pm.");
  });

  it("returns null for non-form minutes bodies", () => {
    expect(parseMinutesFormValues(minutesTemplateHtml({ ...meeting, meeting_time: null, venue: null }))).toBeNull();
    expect(parseMinutesFormValues("")).toBeNull();
  });
});
