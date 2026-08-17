import { DOCUMENT_CATEGORY_LABELS, DOCUMENT_CATEGORIES } from "@/lib/board/types";

export interface AttendeePreset {
  name: string;
  designation: string;
}

/** Typical Worldmark board members offered as quick-fill attendee presets. */
export const BOARD_MEMBER_PRESETS: AttendeePreset[] = [
  { name: "Chief Mrs. Ngozi Okonkwo", designation: "Chairman, Board of Directors" },
  { name: "Barr. Adewale Balogun", designation: "Independent Non-Executive Director" },
  { name: "Dr. Ibrahim Suleiman", designation: "Independent Non-Executive Director" },
  { name: "Mr. Femi Adebayo", designation: "Non-Executive Director" },
  { name: "Mrs. Chidinma Eze", designation: "Non-Executive Director" },
  { name: "Mr. Yemi Johnson", designation: "Non-Executive Director" },
  { name: "Adaeze Okafor", designation: "Managing Director" },
  { name: "Emeka Obi", designation: "Operations Manager (Secretary)" },
  { name: "Funke Adeyemi", designation: "Finance Officer (In Attendance)" },
];

/** One-line explanation used in the meeting form for each meeting type. */
export const MEETING_TYPE_HELP: Record<string, string> = {
  Q1: "Statutory quarterly meeting for Q1 (Jan–Mar). Links to the Q1 NAICOM compliance period.",
  Q2: "Statutory quarterly meeting for Q2 (Apr–Jun). Links to the Q2 NAICOM compliance period.",
  Q3: "Statutory quarterly meeting for Q3 (Jul–Sep). Links to the Q3 NAICOM compliance period.",
  Q4: "Statutory quarterly meeting for Q4 (Oct–Dec). Links to the Q4 NAICOM compliance period.",
  AGM: "Annual General/Board Meeting. No quarterly period link.",
  SPECIAL: "Extraordinary/special board meeting. No quarterly period link.",
};

export const DOCUMENT_CATEGORY_OPTIONS = DOCUMENT_CATEGORIES.map((c) => ({
  value: c,
  label: DOCUMENT_CATEGORY_LABELS[c] ?? c,
}));

export const ATTENDANCE_OPTIONS = [
  { value: "PRESENT", label: "Present" },
  { value: "APOLOGY", label: "Apology" },
  { value: "ABSENT", label: "Absent" },
  { value: "IN_ATTENDANCE", label: "In attendance" },
];

export const RESOLUTION_STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "DEFERRED", label: "Deferred" },
];

export const ACTION_STATUS_OPTIONS = RESOLUTION_STATUS_OPTIONS;

export const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Draft" },
  { value: "REVIEW", label: "Awaiting review" },
  { value: "APPROVED", label: "Approved" },
  { value: "FINAL", label: "Final" },
  { value: "CANCELLED", label: "Cancelled" },
];
