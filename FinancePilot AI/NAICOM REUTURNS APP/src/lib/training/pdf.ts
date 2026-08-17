import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { TrainingRecord } from "@/lib/types/database";

const NAVY = rgb(0.07, 0.13, 0.27);
const GOLD = rgb(0.72, 0.56, 0.19);
const INK = rgb(0.16, 0.17, 0.2);
const GREY = rgb(0.45, 0.47, 0.52);
const LIGHT = rgb(0.93, 0.94, 0.96);

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d} ${months[Number(m) - 1]} ${y}`;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(test, size);
    if (width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function drawTextWrapped(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  size: number,
  color: typeof INK = INK,
  lineHeight = 14
): number {
  const lines = wrapText(text, font, size, maxWidth);
  lines.forEach((line, i) => {
    page.drawText(line, {
      x,
      y: y - i * lineHeight,
      size,
      font,
      color,
    });
  });
  return y - lines.length * lineHeight;
}

interface Cell {
  text: string;
  bold?: boolean;
}

function drawTableHeader(
  page: PDFPage,
  startY: number,
  x: number,
  widths: number[],
  headers: string[],
  font: PDFFont,
  fontSize: number
): number {
  const rowHeight = 20;
  const y = startY;
  let xCursor = x;
  widths.forEach((w, i) => {
    page.drawRectangle({
      x: xCursor,
      y: y - rowHeight,
      width: w,
      height: rowHeight,
      color: NAVY,
    });
    page.drawText(headers[i], {
      x: xCursor + 4,
      y: y - rowHeight + 6,
      size: fontSize,
      font,
      color: rgb(1, 1, 1),
    });
    xCursor += w;
  });
  return y - rowHeight;
}

function drawTableRows(
  page: PDFPage,
  startY: number,
  x: number,
  widths: number[],
  rows: Cell[][],
  font: PDFFont,
  boldFont: PDFFont,
  fontSize: number
): number {
  const rowHeight = 16;
  let y = startY;
  rows.forEach((row, rIdx) => {
    let xCursor = x;
    const maxH = rowHeight;
    row.forEach((cell, cIdx) => {
      const w = widths[cIdx];
      const bg = rIdx % 2 === 1 ? LIGHT : rgb(1, 1, 1);
      page.drawRectangle({
        x: xCursor,
        y: y - rowHeight,
        width: w,
        height: rowHeight,
        color: bg,
        borderColor: rgb(0.82, 0.84, 0.87),
        borderWidth: 0.5,
      });
      const displayText = cell.text.length > 40 ? cell.text.slice(0, 37) + "..." : cell.text;
      page.drawText(displayText, {
        x: xCursor + 4,
        y: y - rowHeight + 5,
        size: fontSize,
        font: cell.bold ? boldFont : font,
        color: INK,
      });
      xCursor += w;
    });
    y -= maxH;
  });
  return y;
}

export async function generateTrainingRecordsPdf(
  records: TrainingRecord[],
  opts: { title?: string; dateRange?: string } = {}
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 841.89; // A4 landscape
  const pageHeight = 595.28;
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Header
  page.drawText("WORLDMARK INSURANCE BROKERS LTD", {
    x: margin,
    y,
    size: 16,
    font: helveticaBold,
    color: NAVY,
  });
  y -= 6;
  page.drawRectangle({
    x: margin,
    y,
    width: contentWidth,
    height: 2,
    color: GOLD,
  });
  y -= 22;

  page.drawText(opts.title ?? "STAFF TRAINING RECORDS", {
    x: margin,
    y,
    size: 14,
    font: helveticaBold,
    color: NAVY,
  });
  y -= 16;

  if (opts.dateRange) {
    page.drawText(opts.dateRange, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: GREY,
    });
    y -= 16;
  }

  page.drawText(`Total records: ${records.length}`, {
    x: margin,
    y,
    size: 9,
    font: helvetica,
    color: GREY,
  });
  y -= 20;

  // Table
  const colWidths = [30, 110, 90, 130, 70, 100, 70, 55, 65, 50];
  const headers = ["#", "STAFF NAME", "POSITION", "TRAINING TITLE", "TYPE", "ORGANIZER", "DATE", "HOURS", "STATUS", "CERT"];

  const rows: Cell[][] = records.map((r, i) => [
    { text: String(i + 1) },
    { text: r.staff_name },
    { text: r.position ?? "—" },
    { text: r.training_title },
    { text: r.training_type ?? "—" },
    { text: r.organizer },
    { text: formatDate(r.training_date) },
    { text: r.duration_hours != null ? String(r.duration_hours) : "—" },
    { text: r.status },
    { text: r.certificate_available ? "Yes" : "—" },
  ]);

  y = drawTableHeader(page, y, margin, colWidths, headers, helveticaBold, 8);

  const rowHeight = 16;
  for (let i = 0; i < rows.length; i++) {
    if (y - rowHeight < margin + 40) {
      // Footer on current page
      page.drawText("Page " + pdfDoc.getPageCount(), {
        x: pageWidth - margin - 40,
        y: margin - 10,
        size: 8,
        font: helvetica,
        color: GREY,
      });
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      y = drawTableHeader(page, y, margin, colWidths, headers, helveticaBold, 8);
    }
    y = drawTableRows(page, y, margin, colWidths, [rows[i]], helvetica, helveticaBold, 7);
  }

  // Footer
  page.drawText("Page " + pdfDoc.getPageCount(), {
    x: pageWidth - margin - 40,
    y: margin - 10,
    size: 8,
    font: helvetica,
    color: GREY,
  });

  // Detailed notes on second page if records exist
  if (records.length > 0) {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;

    page.drawText("TRAINING DETAILS", {
      x: margin,
      y,
      size: 14,
      font: helveticaBold,
      color: NAVY,
    });
    y -= 6;
    page.drawRectangle({
      x: margin,
      y,
      width: contentWidth,
      height: 2,
      color: GOLD,
    });
    y -= 22;

    for (const r of records) {
      if (y < margin + 80) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
      }

      page.drawRectangle({
        x: margin,
        y: y - 2,
        width: contentWidth,
        height: 18,
        color: LIGHT,
      });
      page.drawText(`${r.staff_name} — ${r.training_title}`, {
        x: margin + 4,
        y: y + 1,
        size: 10,
        font: helveticaBold,
        color: NAVY,
      });
      y -= 20;

      const details: [string, string][] = [
        ["Organizer:", r.organizer],
        ["Date:", `${formatDate(r.training_date)}${r.training_end_date ? ` to ${formatDate(r.training_end_date)}` : ""}`],
        ["Location:", r.training_location ?? "—"],
        ["Duration:", r.duration_hours != null ? `${r.duration_hours} hours` : "—"],
        ["Cost:", r.training_cost != null ? `₦${r.training_cost.toLocaleString()}` : "—"],
        ["Certificate:", r.certificate_available ? `Yes — ${r.certificate_file_name ?? "attached"}` : "No"],
      ];

      for (const [label, value] of details) {
        if (y < margin + 20) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
        page.drawText(label, {
          x: margin + 10,
          y,
          size: 8,
          font: helveticaBold,
          color: GREY,
        });
        page.drawText(value, {
          x: margin + 100,
          y,
          size: 8,
          font: helvetica,
          color: INK,
        });
        y -= 13;
      }

      if (r.what_was_learned) {
        page.drawText("Key takeaways:", {
          x: margin + 10,
          y,
          size: 8,
          font: helveticaBold,
          color: GREY,
        });
        y -= 13;
        y = drawTextWrapped(page, r.what_was_learned, margin + 10, y, contentWidth - 20, helvetica, 8, INK, 11);
      }

      if (r.remarks) {
        y -= 4;
        page.drawText("Remarks:", {
          x: margin + 10,
          y,
          size: 8,
          font: helveticaBold,
          color: GREY,
        });
        y -= 13;
        y = drawTextWrapped(page, r.remarks, margin + 10, y, contentWidth - 20, helvetica, 8, INK, 11);
      }

      y -= 16;
    }

    page.drawText("Page " + pdfDoc.getPageCount(), {
      x: pageWidth - margin - 40,
      y: margin - 10,
      size: 8,
      font: helvetica,
      color: GREY,
    });
  }

  return pdfDoc.save();
}
