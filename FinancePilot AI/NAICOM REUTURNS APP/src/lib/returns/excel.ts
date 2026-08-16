import { deflateRawSync } from "zlib";
import { RETURN_COLUMNS, type ReturnColumn } from "@/lib/returns/columns";
import { getExportFormat } from "@/lib/returns/export-format";
import type { ReturnRow, ReturnTotal } from "@/lib/returns/types";

export type WorkbookCell = string | number | null;

export interface WorkbookSheetSpec {
  name: string;
  rows: WorkbookCell[][];
}

interface ZipEntry {
  name: string;
  data: Buffer;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipFile(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data);
    const crc = crc32(data);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(8, 8);
    lh.writeUInt32LE(0, 10);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(compressed.length, 18);
    lh.writeUInt32LE(data.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    localParts.push(lh, nameBuf, compressed);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(0, 12);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(compressed.length, 20);
    ch.writeUInt32LE(data.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(offset, 42);
    centralParts.push(ch, nameBuf);

    offset += lh.length + nameBuf.length + compressed.length;
  }

  const centralStart = offset;
  const central = Buffer.concat(centralParts);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(centralStart, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, central, eocd]);
}

function colName(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cellXml(row: number, col: number, value: WorkbookCell, style?: number): string {
  const ref = `${colName(col)}${row}`;
  if (value === null || value === undefined || value === "") return `<c r="${ref}"/>`;
  const styleAttr = style !== undefined ? ` s="${style}"` : "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
  }
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t>${xmlEscape(String(value))}</t></is></c>`;
}

function sheetXml(spec: WorkbookSheetSpec): string {
  const rowsXml = spec.rows
    .map((cells, i) => {
      const r = i + 1;
      const cellsXml = cells
        .map((c, ci) => cellXml(r, ci, c))
        .join("");
      return `<row r="${r}">${cellsXml}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
}

function contentTypesXml(sheetCount: number): string {
  const overrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${overrides}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function workbookXml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map(
      (name, i) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const rels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}
<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="1"><fill><patternFill patternType="none"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
</cellXfs>
</styleSheet>`;

export function buildXlsx(sheets: WorkbookSheetSpec[]): Buffer {
  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypesXml(sheets.length), "utf8") },
    { name: "_rels/.rels", data: Buffer.from(ROOT_RELS_XML, "utf8") },
    { name: "xl/workbook.xml", data: Buffer.from(workbookXml(sheets.map((s) => s.name)), "utf8") },
    { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRelsXml(sheets.length), "utf8") },
    { name: "xl/styles.xml", data: Buffer.from(STYLES_XML, "utf8") },
  ];
  sheets.forEach((s, i) => {
    entries.push({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: Buffer.from(sheetXml(s), "utf8"),
    });
  });
  return zipFile(entries);
}

export interface ReturnExportOptions {
  code: string;
  rows: ReturnRow[];
  totals: ReturnTotal[];
  periodLabel: string;
  formNumber?: string | null;
  columns?: ReturnColumn[];
}

export interface ReturnExportResult {
  buffer: Buffer;
  filename: string;
}

function formatCellValue(value: unknown): WorkbookCell {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "number" || typeof value === "string" ? value : String(value);
}

function buildDataRows(
  rows: ReturnRow[],
  columns: ReturnColumn[]
): WorkbookCell[][] {
  return rows.map((row) =>
    columns.map((c) => {
      if (c.type === "percent") {
        const n = Number(row[c.key]);
        return Number.isFinite(n) ? n : null;
      }
      if (c.type === "date") {
        return row[c.key] ? String(row[c.key]) : null;
      }
      return formatCellValue(row[c.key]);
    })
  );
}

export function buildReturnSheets(opts: ReturnExportOptions): WorkbookSheetSpec[] {
  const format = getExportFormat(opts.code);
  const columns = opts.columns ?? RETURN_COLUMNS[opts.code] ?? [];
  const sheets: WorkbookSheetSpec[] = [];

  const buildSheet = (name: string, title: string, cols: ReturnColumn[], sheetRows: ReturnRow[], totals: ReturnTotal[]) => {
    const rows: WorkbookCell[][] = [];
    rows.push([title]);
    rows.push([`PERIOD: ${opts.periodLabel}`]);
    if (opts.formNumber) rows.push([`FORM: ${opts.formNumber}`]);
    rows.push([]);
    rows.push(cols.map((c) => c.header));
    rows.push(...buildDataRows(sheetRows, cols));
    if (totals.length > 0) {
      rows.push([]);
      for (const t of totals) {
        rows.push([t.label, t.value]);
      }
    }
    sheets.push({ name: sanitizeSheetName(name), rows });
  };

  if (opts.code === "PERSONNEL") {
    const first = opts.rows.filter((r) => r.schedule === "FIRST");
    const second = opts.rows.filter((r) => r.schedule === "SECOND");
    buildSheet(
      "FIRST SCHEDULE",
      `${format.title} — FIRST SCHEDULE`,
      columns.length > 0 ? columns : RETURN_COLUMNS.PERSONNEL_FIRST,
      first,
      []
    );
    buildSheet(
      "SECOND SCHEDULE",
      `${format.title} — SECOND SCHEDULE`,
      RETURN_COLUMNS.PERSONNEL_SECOND,
      second,
      []
    );
  } else {
    buildSheet(format.form ?? opts.code, format.title, columns, opts.rows, opts.totals);
  }

  return sheets;
}

export function buildReturnWorkbook(opts: ReturnExportOptions): ReturnExportResult {
  const sheets = buildReturnSheets(opts);
  const safePeriod = opts.periodLabel.replace(/[^A-Za-z0-9._-]+/g, "-");
  return {
    buffer: buildXlsx(sheets),
    filename: `${opts.code}-${safePeriod}.xlsx`,
  };
}
