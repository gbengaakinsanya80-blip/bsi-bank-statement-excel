import { inflateRawSync } from "zlib";

export type XlsxCell = string | number | null;

export interface ParsedSheet {
  name: string;
  rows: XlsxCell[][];
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
}

interface ZipEntry {
  name: string;
  method: number;
  data: Buffer;
}

function findEocd(buf: Buffer): number {
  const min = Math.max(0, buf.length - 22 - 65536);
  for (let i = buf.length - 22; i >= min; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Not a valid xlsx (zip) file.");
}

function readZip(buf: Buffer): ZipEntry[] {
  const eocd = findEocd(buf);
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;
    const method = buf.readUInt16LE(offset + 10);
    const compressedSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localOffset = buf.readUInt32LE(offset + 42);

    const name = buf.toString("utf8", offset + 46, offset + 46 + nameLen);

    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compressedSize);

    let data: Buffer;
    if (method === 0) {
      data = raw;
    } else if (method === 8) {
      data = inflateRawSync(raw);
    } else {
      data = Buffer.alloc(0);
    }

    entries.push({ name, method, data });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

function unescapeXml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function attrMap(attrs: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const m of attrs.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g)) {
    map[m[1]] = m[2];
  }
  return map;
}

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  for (const si of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let text = "";
    for (const t of si[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) {
      text += t[1];
    }
    strings.push(unescapeXml(text));
  }
  return strings;
}

const BUILTIN_DATE_FORMATS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58,
]);

function parseStyles(xml: string): { dateStyleIds: Set<number> } {
  const dateStyleIds = new Set<number>();
  const customFormats = new Map<number, string>();

  for (const m of xml.matchAll(/<numFmt\s+numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    customFormats.set(Number(m[1]), m[2].toLowerCase());
  }

  const cellXfsBlock = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  let index = 0;
  for (const m of cellXfsBlock.matchAll(/<xf\b[^>]*\/?>/g)) {
    const attrs = attrMap(m[0].slice(3));
    const numFmtId = Number(attrs.numFmtId ?? "0");
    if (BUILTIN_DATE_FORMATS.has(numFmtId)) {
      dateStyleIds.add(index);
    } else {
      const code = customFormats.get(numFmtId);
      if (code && /[ymdhs]/.test(code)) {
        dateStyleIds.add(index);
      }
    }
    index++;
  }
  return { dateStyleIds };
}

function serialToIsoDate(serial: number): string {
  const days = Math.round(serial);
  const ms = (days - 25569) * 86400000;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function parseSheet(
  xml: string,
  sharedStrings: string[],
  dateStyleIds: Set<number>
): XlsxCell[][] {
  const rows: XlsxCell[][] = [];

  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttrs = attrMap(rowMatch[1]);
    const rowIndex = Number(rowAttrs.r ?? rows.length + 1);
    const cells = new Map<number, XlsxCell>();

    for (const cellMatch of rowMatch[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = attrMap(cellMatch[1]);
      const ref = attrs.r ?? "";
      const colIndex = columnIndexFromRef(ref);
      const type = attrs.t ?? "n";
      const style = attrs.s ? Number(attrs.s) : undefined;
      const inner = cellMatch[2] ?? "";

      const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/);
      let value: XlsxCell = null;

      if (type === "s") {
        const idx = vMatch ? Number(vMatch[1]) : -1;
        value = idx >= 0 && idx < sharedStrings.length ? sharedStrings[idx] : null;
      } else if (type === "inlineStr") {
        const tMatch = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        value = tMatch ? unescapeXml(tMatch[1]) : null;
      } else if (type === "str") {
        value = vMatch ? unescapeXml(vMatch[1]) : null;
      } else {
        const raw = vMatch ? unescapeXml(vMatch[1]) : null;
        if (raw === null || raw === "") {
          value = null;
        } else if (dateStyleIds.has(style ?? 0)) {
          const serial = Number(raw);
          value = Number.isFinite(serial) ? serialToIsoDate(serial) : raw;
        } else {
          const n = Number(raw);
          value = Number.isFinite(n) ? n : raw;
        }
      }

      cells.set(colIndex, value);
    }

    const row: XlsxCell[] = [];
    const maxCol = Math.max(0, ...cells.keys());
    for (let c = 0; c <= maxCol; c++) row.push(cells.get(c) ?? null);
    rows[rowIndex - 1] = row;
  }

  return rows.filter((r) => r !== undefined);
}

function columnIndexFromRef(ref: string): number {
  const letters = (ref.match(/^[A-Z]+/) ?? [""])[0];
  let col = 0;
  for (const ch of letters) col = col * 26 + (ch.charCodeAt(0) - 64);
  return col - 1;
}

export function parseXlsx(buffer: Buffer): ParsedWorkbook {
  const entries = readZip(buffer);
  const get = (name: string) => entries.find((e) => e.name === name)?.data;

  const sharedStrings = parseSharedStrings(get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const { dateStyleIds } = parseStyles(get("xl/styles.xml")?.toString("utf8") ?? "");

  const sheetXml: { name: string; data: string }[] = [];
  for (const e of entries) {
    const m = /^xl\/worksheets\/sheet(\d+)\.xml$/.exec(e.name);
    if (m) sheetXml.push({ name: `sheet${m[1]}`, data: e.data.toString("utf8") });
  }
  sheetXml.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const workbook = get("xl/workbook.xml")?.toString("utf8") ?? "";
  const sheetNames = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]*)"/g)].map((m) => m[1]);

  const sheets = sheetXml.map((s, i) => ({
    name: sheetNames[i] ?? s.name,
    rows: parseSheet(s.data, sharedStrings, dateStyleIds),
  }));

  return { sheets };
}

/** Best-effort sniff: the supplied "csv" files are xlsx binaries (PRD §45). */
export function isXlsxBuffer(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer.readUInt32LE(0) === 0x04034b50;
}
