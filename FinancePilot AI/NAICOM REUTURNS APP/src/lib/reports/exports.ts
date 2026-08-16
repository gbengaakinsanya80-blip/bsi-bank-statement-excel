import { buildXlsx, type WorkbookCell, type WorkbookSheetSpec } from "@/lib/returns/excel";

export interface ReportTableSpec {
  name: string;
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 31) || "Sheet";
}

function workbookRowValue(value: string | number | null): WorkbookCell {
  if (value === null || value === undefined || value === "") return null;
  return value;
}

export function buildReportWorkbook(title: string, tables: ReportTableSpec[]): Buffer {
  const sheets: WorkbookSheetSpec[] = tables.map((t) => {
    const rows: WorkbookCell[][] = [
      [title],
      [],
      t.columns,
      ...t.rows.map((r) => r.map(workbookRowValue)),
    ];
    return { name: sanitizeSheetName(t.name), rows };
  });
  return buildXlsx(sheets);
}

export function buildReportCsv(columns: string[], rows: (string | number | null)[][]): string {
  const escape = (v: string | number | null): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return lines.join("\r\n");
}

export function reportFilename(base: string, format: "xlsx" | "csv"): string {
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "-");
  return `${safe}.${format}`;
}
