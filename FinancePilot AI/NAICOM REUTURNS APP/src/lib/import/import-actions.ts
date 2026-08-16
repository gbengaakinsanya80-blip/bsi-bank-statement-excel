"use server";

import { requireAppUser } from "@/lib/auth/guard";
import { createServerSupabase } from "@/lib/supabase/server";
import { isXlsxBuffer, parseXlsx, type XlsxCell } from "@/lib/import/xlsx-reader";
import {
  createImportSession,
  getImportSession,
  updateImportSession,
} from "@/lib/import/session-store";
import { validateSheet, type ImportValidationSummary } from "@/lib/import/validation";
import { persistRecords } from "@/lib/import/writer";
import { detectHeaderRow, type ColumnMapping } from "@/lib/import/mapping";

export type UploadImportResult = {
  ok: boolean;
  error?: string;
  sessionId?: string;
  fileName?: string;
  sheetName?: string;
  headers?: string[];
  mappings?: ColumnMapping[];
  totalRows?: number;
  preview?: XlsxCell[][];
};

export type ValidateImportResult = {
  ok: boolean;
  error?: string;
  summary?: ImportValidationSummary;
};

export type ConfirmImportResult = {
  ok: boolean;
  error?: string;
  count?: number;
  total?: number;
  invalid?: number;
  duplicates?: number;
};

export async function uploadImportAction(formData: FormData): Promise<UploadImportResult> {
  await requireAppUser();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No file selected." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!isXlsxBuffer(buffer)) {
    return {
      ok: false,
      error: "Unsupported file — expected an Excel (.xlsx) workbook. (The import sniffs file content, not the extension.)",
    };
  }

  let workbook;
  try {
    workbook = parseXlsx(buffer);
  } catch {
    return { ok: false, error: "Could not read the workbook. Make sure it is a valid .xlsx file." };
  }

  const sheet = workbook.sheets[0];
  if (!sheet) return { ok: false, error: "The workbook has no sheets." };

  const headerRow = detectHeaderRow(sheet.rows);
  const headers = (sheet.rows[headerRow] ?? []).map((c) => (c === null ? "" : String(c)));
  const rows = sheet.rows.slice(headerRow + 1);
  const session = await createImportSession({
    fileName: file.name,
    sheetName: sheet.name,
    headers,
    rows,
  });

  return {
    ok: true,
    sessionId: session.id,
    fileName: file.name,
    sheetName: sheet.name,
    headers: session.headers,
    mappings: session.mapping,
    totalRows: rows.length,
    preview: rows.slice(0, 8),
  };
}

export async function validateImportAction(
  sessionId: string,
  mapping: ColumnMapping[]
): Promise<ValidateImportResult> {
  const session = await getImportSession(sessionId);
  if (!session) return { ok: false, error: "Session expired — upload the file again." };

  const summary = validateSheet(session.rows, mapping);
  await updateImportSession(sessionId, { mapping });
  return { ok: true, summary };
}

export async function confirmImportAction(
  sessionId: string,
  mapping: ColumnMapping[]
): Promise<ConfirmImportResult> {
  const session = await getImportSession(sessionId);
  if (!session) return { ok: false, error: "Session expired — upload the file again." };

  const summary = validateSheet(session.rows, mapping);
  await updateImportSession(sessionId, { mapping });

  const records = summary.results
    .filter((r) => r.valid && !r.duplicate)
    .map((r) => r.record!);

  if (records.length === 0) {
    return { ok: false, error: "No valid records to import. Fix the invalid rows first." };
  }

  const user = await requireAppUser();
  const supabase = await createServerSupabase();
  try {
    const { count } = await persistRecords(records, user.id, supabase);
    return {
      ok: true,
      count,
      total: summary.total,
      invalid: summary.invalid,
      duplicates: summary.duplicates,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Import failed." };
  }
}
