import type { XlsxCell } from "@/lib/import/xlsx-reader";
import type { ColumnMapping } from "@/lib/import/mapping";
import { detectCurrency, fieldMeta, type ImportFieldMeta } from "@/lib/import/mapping";

export interface NormalizedValue {
  ok: boolean;
  value: unknown;
  message?: string;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isSentinel(value: string): boolean {
  const upper = value.toUpperCase();
  return upper === "NIL" || upper === "NA" || upper === "N/A" || value === "-" || value === "—";
}

function isoDate(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function serialToIso(serial: number): string {
  const ms = (Math.round(serial) - 25569) * 86400000;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function parseAmount(raw: XlsxCell): NormalizedValue {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw === "number") {
    if (Number.isFinite(raw)) return { ok: true, value: raw };
    return { ok: false, value: null, message: `"${raw}" is not a valid amount.` };
  }
  const s = String(raw).trim();
  if (s === "" || isSentinel(s)) return { ok: true, value: null };
  const cleaned = s
    .replace(/^(?:USD|NGN|GBP|EUR)\s*/i, "")
    .replace(/[₦$€£,()\s]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, value: null, message: `"${raw}" is not a valid amount.` };
  if (n < 0) return { ok: false, value: null, message: `"${raw}" must not be negative.` };
  return { ok: true, value: n };
}

export function parsePercent(raw: XlsxCell): NormalizedValue {
  const result = parseAmount(raw);
  if (!result.ok || result.value === null) return result;
  return { ok: true, value: result.value };
}

export function parseDateValue(raw: XlsxCell): NormalizedValue {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { ok: true, value: serialToIso(raw) };
  }
  const s = String(raw).trim();
  if (s === "" || isSentinel(s)) return { ok: true, value: null };

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (iso) {
    const out = isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return out
      ? { ok: true, value: out }
      : { ok: false, value: null, message: `"${raw}" is an impossible date.` };
  }

  const slashIso = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (slashIso) {
    const out = isoDate(Number(slashIso[1]), Number(slashIso[2]), Number(slashIso[3]));
    return out
      ? { ok: true, value: out }
      : { ok: false, value: null, message: `"${raw}" is an impossible date.` };
  }

  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (dmy) {
    const a = Number(dmy[1]);
    const b = Number(dmy[2]);
    const y = Number(dmy[3]);
    let day = a;
    let month = b;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    } else if (b > 12 && a <= 12) {
      day = b;
      month = a;
    } else {
      day = a;
      month = b;
    }
    const out = isoDate(y, month, day);
    return out
      ? { ok: true, value: out }
      : { ok: false, value: null, message: `"${raw}" is an impossible date.` };
  }

  const dMonY = /^(\d{1,2})\s+([A-Za-z]{3,9})[-\s,]?\s*(\d{4})$/.exec(s);
  if (dMonY) {
    const month = MONTHS[dMonY[2].slice(0, 3).toLowerCase()];
    const out = month ? isoDate(Number(dMonY[3]), month, Number(dMonY[1])) : null;
    return out
      ? { ok: true, value: out }
      : { ok: false, value: null, message: `"${raw}" is not a valid date.` };
  }

  const monDY = /^([A-Za-z]{3,9})[-\s]\s*(\d{1,2})[,\s]\s*(\d{4})$/.exec(s);
  if (monDY) {
    const month = MONTHS[monDY[1].slice(0, 3).toLowerCase()];
    const out = month ? isoDate(Number(monDY[3]), month, Number(monDY[2])) : null;
    return out
      ? { ok: true, value: out }
      : { ok: false, value: null, message: `"${raw}" is not a valid date.` };
  }

  return { ok: false, value: null, message: `"${raw}" is not a valid date.` };
}

function normalizeByType(raw: XlsxCell, meta: ImportFieldMeta): NormalizedValue {
  switch (meta.type) {
    case "money":
      return parseAmount(raw);
    case "percent":
      return parsePercent(raw);
    case "date":
      return parseDateValue(raw);
    default:
      if (raw === null || raw === undefined) return { ok: true, value: null };
      const s = String(raw).trim();
      return { ok: true, value: s === "" || isSentinel(s) ? null : s };
  }
}

export interface ImportRowResult {
  rowNumber: number;
  data: XlsxCell[];
  valid: boolean;
  issues: string[];
  record: Record<string, unknown> | null;
  duplicate: boolean;
}

export interface ImportValidationSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  results: ImportRowResult[];
}

export function duplicateKey(record: Record<string, unknown>): string | null {
  const policy = record.policy_number;
  if (!policy) return null;
  return [
    String(policy),
    record.endorsement_number ?? "",
    record.client_name ?? "",
    record.insurer_name ?? "",
    record.transaction_date ?? "",
    record.gross_premium ?? "",
  ].join("|");
}

export function validateSheet(
  rows: XlsxCell[][],
  mapping: ColumnMapping[],
  headerRow = -1
): ImportValidationSummary {
  const results: ImportRowResult[] = [];
  const seen = new Map<string, number>();

  rows.slice(headerRow + 1).forEach((row, offset) => {
    const rowNumber = headerRow + 1 + offset + 1;
    const issues: string[] = [];
    const record: Record<string, unknown> = {};
    let hasData = false;
    let currency: "NGN" | "USD" = "NGN";

    for (const col of mapping) {
      const meta = col.targetKey ? fieldMeta(col.targetKey) : undefined;
      if (!meta) continue;
      const raw = row[col.index] ?? null;
      if (raw !== null && raw !== undefined && String(raw).trim() !== "") hasData = true;

      const normalized = normalizeByType(raw, meta);
      if (!normalized.ok) {
        issues.push(`Column "${col.sourceHeader}" (row ${rowNumber}): ${normalized.message}`);
        continue;
      }
      record[meta.key] = normalized.value;
      if (meta.type === "money" && detectCurrency(col.sourceHeader) === "USD") {
        currency = "USD";
      }
    }

    if (!hasData) return;

    record.currency = currency;
    record.is_demo = true;

    if (!record.policy_number) {
      issues.push(`Row ${rowNumber}: policy number is required.`);
    }

    const key = duplicateKey(record);
    const duplicate = key !== null && seen.has(key);
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1);

    results.push({
      rowNumber,
      data: row,
      valid: issues.length === 0,
      issues,
      record: issues.length === 0 ? record : null,
      duplicate,
    });
  });

  const valid = results.filter((r) => r.valid && !r.duplicate).length;
  const duplicates = results.filter((r) => r.duplicate).length;

  return {
    total: results.length,
    valid,
    invalid: results.length - valid - duplicates,
    duplicates,
    results,
  };
}
