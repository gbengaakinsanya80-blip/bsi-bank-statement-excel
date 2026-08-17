export const COMPANY_NAME = "WORLDMARK INSURANCE BROKERS LIMITED";
export const BOARD_TITLE = "MINUTES OF BOARD OF DIRECTORS MEETING";

export interface MinutesTemplate {
  company: string;
  title: string;
  meetingNumber: string;
  quarter: string;
  financialYear: string;
  date: string;
  time: string;
  venue: string;
  sections: {
    present: string[];
    apologies: string[];
    absent: string[];
    inAttendance: string[];
    agenda: string[];
  };
}

export const DEFAULT_AGENDA = [
  "Opening",
  "Confirmation of previous minutes",
  "Matters arising",
  "Chairman's report",
  "Managing Director/Management report",
  "Financial performance",
  "Insurance business performance",
  "Regulatory/NAICOM compliance",
  "Risk management",
  "Audit/internal control",
  "Human resources",
  "Claims/business matters",
  "Any other business",
  "Closing",
];

export function standardMinutesTemplate(): MinutesTemplate {
  return {
    company: COMPANY_NAME,
    title: BOARD_TITLE,
    meetingNumber: "",
    quarter: "",
    financialYear: "",
    date: "",
    time: "",
    venue: "",
    sections: {
      present: [],
      apologies: [],
      absent: [],
      inAttendance: [],
      agenda: [...DEFAULT_AGENDA],
    },
  };
}

/**
 * Renders the standard minutes template as the initial rich-text body
 * (HTML) used to seed the minutes editor for a new meeting.
 */
export function minutesTemplateHtml(meeting: {
  meeting_number: string;
  meeting_type: string;
  quarter: number | null;
  financial_year: number;
  meeting_date: string;
  meeting_time: string | null;
  venue: string | null;
}): string {
  const quarterLabel = meeting.quarter ? `Q${meeting.quarter}` : "—";
  const meetingType = meetingTypeName(meeting.meeting_type);

  const rows = [
    ["Meeting Number", meeting.meeting_number || "—"],
    ["Meeting Type", meetingType],
    ["Quarter", quarterLabel],
    ["Financial Year", String(meeting.financial_year)],
    ["Date", meeting.meeting_date || "—"],
    ["Time", meeting.meeting_time || "—"],
    ["Venue", meeting.venue || "—"],
  ]
    .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`)
    .join("");

  const agenda = DEFAULT_AGENDA.map((a) => `<li>${escapeHtml(a)}</li>`).join("");

  return `<p><strong>${escapeHtml(COMPANY_NAME)}</strong></p>
<p><strong>${escapeHtml(BOARD_TITLE)}</strong></p>
<ul>${rows}</ul>
<h3>PRESENT</h3>
<p><br></p>
<h3>APOLOGIES</h3>
<p><br></p>
<h3>ABSENT</h3>
<p><br></p>
<h3>IN ATTENDANCE</h3>
<p><br></p>
<h3>AGENDA</h3>
<ol>${agenda}</ol>`;
}

export function meetingTypeName(type: string): string {
  switch (type) {
    case "Q1":
      return "Q1 Board Meeting";
    case "Q2":
      return "Q2 Board Meeting";
    case "Q3":
      return "Q3 Board Meeting";
    case "Q4":
      return "Q4 Board Meeting";
    case "AGM":
      return "Annual General/Board Meeting";
    default:
      return "Special Board Meeting";
  }
}

// ------------------------------------------------------------------
// Minutes form → minutes document
// ------------------------------------------------------------------

export interface MinutesAgendaRow {
  title: string;
  deliberation: string;
}

/** Values captured by the minutes form; meeting metadata is read from the meeting record. */
export interface MinutesFormValues {
  openingPrayer: string;
  present: string[];
  apologies: string[];
  absent: string[];
  inAttendance: string[];
  agenda: MinutesAgendaRow[];
  adjournment: string;
}

/**
 * Builds the minutes body HTML from the minutes form values.
 * The generated markup is intentionally simple and stable so it can be
 * parsed back into the form for further editing.
 */
export function buildMinutesFormHtml(
  meeting: {
    meeting_number: string;
    meeting_type: string;
    quarter: number | null;
    financial_year: number;
    meeting_date: string;
    meeting_time: string | null;
    venue: string | null;
    chairman: string | null;
    secretary: string | null;
  },
  values: MinutesFormValues
): string {
  const rows = [
    ["Meeting Number", meeting.meeting_number || "—"],
    ["Meeting Type", meetingTypeName(meeting.meeting_type)],
    ["Quarter", meeting.quarter ? `Q${meeting.quarter}` : "—"],
    ["Financial Year", String(meeting.financial_year)],
    ["Date", meeting.meeting_date || "—"],
    ["Time", meeting.meeting_time || "—"],
    ["Venue", meeting.venue || "—"],
    ["Chairman", meeting.chairman || "—"],
    ["Secretary", meeting.secretary || "—"],
  ]
    .map(([k, v]) => `<li><strong>${escapeHtml(k)}:</strong> ${escapeHtml(v)}</li>`)
    .join("");

  const opening =
    `The meeting was declared open at ${meeting.meeting_time || "the scheduled time"} ` +
    (meeting.chairman ? `by ${meeting.chairman}.` : "by the Chairman.") +
    (values.openingPrayer.trim()
      ? ` The opening prayer was said by ${values.openingPrayer.trim()}.`
      : "");

  const list = (items: string[]) =>
    items.length
      ? items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")
      : "<li><br></li>";

  const agenda = values.agenda
    .map(
      (item, i) =>
        `<li><strong>${i + 1}. ${escapeHtml(item.title)}</strong><br>${escapeMultiline(item.deliberation)}</li>`
    )
    .join("");

  return `<p><strong>${escapeHtml(COMPANY_NAME)}</strong></p>
<p><strong>${escapeHtml(BOARD_TITLE)}</strong></p>
<ul>${rows}</ul>
<h3>OPENING</h3>
<p>${escapeHtml(opening)}</p>
<h3>PRESENT</h3>
<ul>${list(values.present)}</ul>
<h3>APOLOGIES</h3>
<ul>${list(values.apologies)}</ul>
<h3>ABSENT</h3>
<ul>${list(values.absent)}</ul>
<h3>IN ATTENDANCE</h3>
<ul>${list(values.inAttendance)}</ul>
<h3>AGENDA</h3>
<ol>${agenda || "<li><br></li>"}</ol>
<h3>ADJOURNMENT</h3>
<p>${escapeMultiline(values.adjournment)}</p>`;
}

/**
 * Reads minutes-form values back out of a previously generated minutes body,
 * so the form can be reopened with the content preserved. Returns null when
 * the HTML was not produced by this form.
 */
export function parseMinutesFormValues(html: string): MinutesFormValues | null {
  if (!html || !html.includes("<h3>OPENING</h3>")) return null;

  const section = (label: string): string => {
    const match = html.match(new RegExp(`<h3>${label}</h3>([\\s\\S]*?)(?=<h3>|$)`));
    return match ? match[1] : "";
  };

  const listItems = (label: string): string[] =>
    (section(label).match(/<li>([\s\S]*?)<\/li>/g) ?? [])
      .map((li) => htmlToText(li))
      .filter((t) => t !== "");

  const opening = htmlToText(section("OPENING"));
  const prayerStart = opening.indexOf("said by ");
  const openingPrayer =
    prayerStart >= 0
      ? opening
          .slice(prayerStart + "said by ".length)
          .replace(/\.\s*$/, "")
          .trim()
      : "";

  const agenda: MinutesAgendaRow[] = [];
  const itemPattern = /<li><strong>\d+\.\s*([\s\S]*?)<\/strong>(?:<br>)?([\s\S]*?)<\/li>/g;
  let match: RegExpExecArray | null;
  while ((match = itemPattern.exec(section("AGENDA"))) !== null) {
    agenda.push({ title: htmlToText(match[1]), deliberation: htmlToText(match[2]) });
  }

  return {
    openingPrayer,
    present: listItems("PRESENT"),
    apologies: listItems("APOLOGIES"),
    absent: listItems("ABSENT"),
    inAttendance: listItems("IN ATTENDANCE"),
    agenda,
    adjournment: htmlToText(section("ADJOURNMENT")),
  };
}

function escapeMultiline(value: string): string {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
