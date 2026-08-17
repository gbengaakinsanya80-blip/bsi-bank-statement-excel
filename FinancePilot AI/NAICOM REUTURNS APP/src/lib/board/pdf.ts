import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { BoardMeeting } from "@/lib/board/types";
import { meetingTypeLabel, MEETING_STATUS_LABELS } from "@/lib/board/types";
import { COMPANY_NAME } from "@/lib/board/template";

const NAVY = rgb(0.07, 0.13, 0.27);
const GOLD = rgb(0.72, 0.56, 0.19);
const INK = rgb(0.16, 0.17, 0.2);
const GREY = rgb(0.45, 0.47, 0.52);
const LIGHT = rgb(0.93, 0.94, 0.96);

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return formatDate(iso);
}

interface Cell {
  text: string;
  bold?: boolean;
  color?: (typeof INK) | (typeof GREY);
}

function drawTable(
  page: PDFPage,
  startY: number,
  x: number,
  widths: number[],
  rows: Cell[][],
  font: PDFFont,
  boldFont: PDFFont,
  fontSize: number
): number {
  const rowHeight = 18;
  let y = startY;
  rows.forEach((row, rIdx) => {
    let xCursor = x;
    row.forEach((cell, cIdx) => {
      const w = widths[cIdx];
      const bg = rIdx % 2 === 1 ? LIGHT : rgb(1, 1, 1);
      page.drawRectangle({ x: xCursor, y: y - rowHeight, width: w, height: rowHeight, color: bg, borderColor: rgb(0.82, 0.84, 0.87), borderWidth: 0.5 });
      page.drawText(cell.text, {
        x: xCursor + 5,
        y: y - rowHeight + 6,
        size: fontSize,
        font: cell.bold ? boldFont : font,
        color: cell.color ?? INK,
      });
      xCursor += w;
    });
    y -= rowHeight;
  });
  return y;
}

/**
 * Generates a formal minutes cover/report PDF for a board meeting.
 * The rich-text minutes body remains editable in-app; this PDF provides a
 * print-ready formal record (details, attendees, agenda, resolutions,
 * action points) with logo slot, page numbers and confidentiality footer.
 */
export async function generateBoardMinutesPdf(
  meeting: BoardMeeting,
  opts: { includeMinutes?: boolean } = {}
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 54;
  const pageWidth = 595; // A4 portrait
  const contentWidth = pageWidth - margin * 2;

  const { includeMinutes = false } = opts;

  const header = (page: PDFPage) => {
    page.drawRectangle({ x: 0, y: 792 - 78, width: pageWidth, height: 78, color: NAVY });
    page.drawRectangle({ x: 0, y: 792 - 84, width: pageWidth, height: 6, color: GOLD });
    page.drawText(COMPANY_NAME, { x: margin, y: 792 - 34, size: 12, font: bold, color: rgb(1, 1, 1) });
    page.drawText("Board of Directors - Minutes of Meeting", { x: margin, y: 792 - 54, size: 10, font, color: rgb(0.85, 0.87, 0.92) });
    page.drawText("CONFIDENTIAL", { x: pageWidth - margin - 70, y: 792 - 34, size: 10, font: bold, color: GOLD });
  };

  const footer = (page: PDFPage, pageNumber: number) => {
    page.drawText("This document contains confidential information. For internal use only.", {
      x: margin, y: 30, size: 8, font, color: GREY,
    });
    page.drawText(`Page ${pageNumber}`, { x: pageWidth - margin - 40, y: 30, size: 8, font, color: GREY });
  };

  // ----- Page 1: details, attendees, agenda -----
  const page1 = doc.addPage([pageWidth, 792]);
  header(page1);

  const title = `MINUTES OF ${meetingTypeLabel(meeting.meeting_type)}`;
  const titleWidth = bold.widthOfTextAtSize(title, 16);
  page1.drawText(title, { x: margin, y: 792 - 130, size: 16, font: bold, color: NAVY });
  page1.drawLine({ start: { x: margin, y: 792 - 138 }, end: { x: margin + Math.min(titleWidth, contentWidth), y: 792 - 138 }, thickness: 2, color: GOLD });

  const details: Cell[][] = [
    [
      { text: "Meeting Number", bold: true },
      { text: meeting.meeting_number || "—" },
      { text: "Meeting Type", bold: true },
      { text: meetingTypeLabel(meeting.meeting_type) },
    ],
    [
      { text: "Quarter", bold: true },
      { text: meeting.quarter ? `Q${meeting.quarter}` : "N/A" },
      { text: "Financial Year", bold: true },
      { text: String(meeting.financial_year) },
    ],
    [
      { text: "Date", bold: true },
      { text: formatDate(meeting.meeting_date) },
      { text: "Time", bold: true },
      { text: meeting.meeting_time || "—" },
    ],
    [
      { text: "Venue", bold: true },
      { text: meeting.venue || "—" },
      { text: "Status", bold: true },
      { text: MEETING_STATUS_LABELS[meeting.status] },
    ],
    [
      { text: "Chairman", bold: true },
      { text: meeting.chairman || "—" },
      { text: "Secretary", bold: true },
      { text: meeting.secretary || "—" },
    ],
    [
      { text: "Reporting Period", bold: true },
      { text: meeting.period_start && meeting.period_end ? `${meeting.period_start} to ${meeting.period_end}` : "—" },
      { text: "Approved", bold: true },
      { text: meeting.date_approved ? formatDateTime(meeting.date_approved) : "—" },
    ],
  ];

  let y = drawTable(page1, 792 - 158, margin, [150, 220, 130, contentWidth - 500], details, font, bold, 10);

  const section = (label: string, yPos: number): number => {
    page1.drawText(label, { x: margin, y: yPos, size: 11, font: bold, color: NAVY });
    return yPos - 18;
  };

  y = section("ATTENDEES", y - 10);
  const attendees = meeting.attendees.length
    ? meeting.attendees.map((a) => [
        { text: a.name },
        { text: a.designation || "—" },
        { text: a.presence.replace(/_/g, " ") },
      ] as Cell[])
    : [[{ text: "No attendees recorded." }, { text: "", color: GREY }, { text: "", color: GREY }]];
  y = drawTable(page1, y, margin, [230, 220, contentWidth - 450], attendees, font, bold, 10);

  y = section("AGENDA", y - 12);
  if (meeting.agenda.length) {
    meeting.agenda.forEach((item) => {
      page1.drawText(`${item.order}.  ${item.title}`, { x: margin + 6, y: y - 4, size: 10, font, color: INK });
      y -= 16;
    });
  } else {
    page1.drawText("No agenda items recorded.", { x: margin + 6, y: y - 4, size: 10, font, color: GREY });
  }

  footer(page1, 1);

  // ----- Page 2: resolutions & action points -----
  const page2 = doc.addPage([pageWidth, 792]);
  header(page2);

  let y2 = sectionOn(page2, "RESOLUTIONS", 792 - 130, bold);

  if (meeting.resolutions.length) {
    meeting.resolutions.forEach((r) => {
      const text = `${r.resolution_number}. ${r.resolution}`;
      const lines = wrapText(font, text, contentWidth - 12, 10);
      lines.forEach((line) => {
        page2.drawText(line, { x: margin + 6, y: y2 - 4, size: 10, font, color: INK });
        y2 -= 14;
      });
      const meta = [`Status: ${r.status.replace(/_/g, " ")}`];
      if (r.responsible_person) meta.push(`Responsible: ${r.responsible_person}`);
      if (r.due_date) meta.push(`Due: ${formatDate(r.due_date)}`);
      page2.drawText(meta.join("   |   "), { x: margin + 6, y: y2 - 4, size: 8, font: bold, color: GREY });
      y2 -= 22;
    });
  } else {
    page2.drawText("No resolutions recorded.", { x: margin + 6, y: y2 - 4, size: 10, font, color: GREY });
    y2 -= 18;
  }

  y2 = sectionOn(page2, "ACTION POINTS", y2 - 10, bold);
  if (meeting.action_points.length) {
    meeting.action_points.forEach((a, idx) => {
      const text = `${idx + 1}. ${a.action}`;
      const lines = wrapText(font, text, contentWidth - 12, 10);
      lines.forEach((line) => {
        page2.drawText(line, { x: margin + 6, y: y2 - 4, size: 10, font, color: INK });
        y2 -= 14;
      });
      const meta = [`Status: ${a.status.replace(/_/g, " ")}`];
      if (a.responsible_person) meta.push(`Responsible: ${a.responsible_person}`);
      if (a.due_date) meta.push(`Due: ${formatDate(a.due_date)}`);
      page2.drawText(meta.join("   |   "), { x: margin + 6, y: y2 - 4, size: 8, font: bold, color: GREY });
      y2 -= 22;
    });
  } else {
    page2.drawText("No action points recorded.", { x: margin + 6, y: y2 - 4, size: 10, font, color: GREY });
  }

  footer(page2, 2);

  if (includeMinutes) {
    const page3 = doc.addPage([pageWidth, 792]);
    header(page3);
    page3.drawText("APPROVED MINUTES (PREVIEW)", { x: margin, y: 792 - 130, size: 11, font: bold, color: NAVY });
    page3.drawText("The full minutes body is available in the application editor.", {
      x: margin, y: 792 - 150, size: 10, font, color: GREY,
    });
    footer(page3, 3);
  }

  return doc.save();
}

function sectionOn(
  page: PDFPage,
  label: string,
  yPos: number,
  font: PDFFont
): number {
  page.drawText(label, { x: 54, y: yPos, size: 11, font, color: NAVY });
  return yPos - 18;
}

/** Strips HTML tags for PDF-friendly text display. */
export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wrapText(font: PDFFont, text: string, maxWidth: number, size: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = word;
    }
  });
  if (line) lines.push(line);
  return lines;
}
