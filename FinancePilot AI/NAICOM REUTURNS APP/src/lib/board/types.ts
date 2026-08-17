export const BOARD_MEETING_TYPES = ["Q1", "Q2", "Q3", "Q4", "AGM", "SPECIAL"] as const;
export type BoardMeetingType = (typeof BOARD_MEETING_TYPES)[number];

export const BOARD_MEETING_TYPE_LABELS: Record<BoardMeetingType, string> = {
  Q1: "Q1 Board Meeting",
  Q2: "Q2 Board Meeting",
  Q3: "Q3 Board Meeting",
  Q4: "Q4 Board Meeting",
  AGM: "Annual General/Board Meeting",
  SPECIAL: "Special Board Meeting",
};

export const MEETING_STATUSES = ["DRAFT", "REVIEW", "APPROVED", "FINAL", "CANCELLED"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const ATTENDANCE_TYPES = ["PRESENT", "APOLOGY", "ABSENT", "IN_ATTENDANCE"] as const;
export type AttendanceType = (typeof ATTENDANCE_TYPES)[number];

export const RESOLUTION_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "DEFERRED"] as const;
export type ResolutionStatus = (typeof RESOLUTION_STATUSES)[number];

export const ACTION_STATUSES = ["OPEN", "IN_PROGRESS", "COMPLETED", "DEFERRED"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const DOCUMENT_CATEGORIES = [
  "PREVIOUS_MINUTES",
  "BOARD_PAPERS",
  "FINANCIAL_REPORT",
  "MANAGEMENT_REPORT",
  "REGULATORY_REPORT",
  "SUPPORTING_DOCUMENT",
  "SIGNED_MINUTES",
  "ATTENDANCE_SHEET",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export interface BoardAttendee {
  id: string;
  name: string;
  designation: string | null;
  presence: AttendanceType;
}

export interface BoardAgendaItem {
  id: string;
  order: number;
  title: string;
}

export interface BoardResolution {
  id: string;
  resolution_number: number;
  agenda_item: string | null;
  resolution: string;
  responsible_person: string | null;
  due_date: string | null;
  status: ResolutionStatus;
  remarks: string | null;
}

export interface BoardActionPoint {
  id: string;
  action: string;
  responsible_person: string | null;
  due_date: string | null;
  status: ActionStatus;
  remarks: string | null;
}

export interface BoardDocument {
  id: string;
  name: string;
  category: DocumentCategory | string;
  path: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface BoardMeeting {
  id: string;
  meeting_number: string;
  meeting_type: BoardMeetingType;
  quarter: number | null;
  financial_year: number;
  meeting_date: string;
  meeting_time: string | null;
  venue: string | null;
  status: MeetingStatus;
  chairman: string | null;
  secretary: string | null;
  agenda: BoardAgendaItem[];
  minutes: string;
  attendees: BoardAttendee[];
  resolutions: BoardResolution[];
  action_points: BoardActionPoint[];
  documents: BoardDocument[];
  period_start: string | null;
  period_end: string | null;
  date_approved: string | null;
  approved_by: string | null;
  reopen_reason: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  DRAFT: "Draft",
  REVIEW: "Awaiting Review",
  APPROVED: "Approved",
  FINAL: "Final",
  CANCELLED: "Cancelled",
};

/** Allowed minutes-workflow transitions for a given status. */
export const MEETING_STATUS_TRANSITIONS: Record<MeetingStatus, MeetingStatus[]> = {
  DRAFT: ["REVIEW"],
  REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["FINAL", "REVIEW"],
  FINAL: ["REVIEW"],
  CANCELLED: [],
};

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  PREVIOUS_MINUTES: "Previous minutes",
  BOARD_PAPERS: "Board papers",
  FINANCIAL_REPORT: "Financial report",
  MANAGEMENT_REPORT: "Management report",
  REGULATORY_REPORT: "Regulatory report",
  SUPPORTING_DOCUMENT: "Supporting document",
  SIGNED_MINUTES: "Signed minutes",
  ATTENDANCE_SHEET: "Attendance sheet",
};

export function isBoardEditLocked(status: MeetingStatus): boolean {
  return status === "FINAL";
}

export function meetingTypeLabel(type: string): string {
  return BOARD_MEETING_TYPE_LABELS[type as BoardMeetingType] ?? type;
}
