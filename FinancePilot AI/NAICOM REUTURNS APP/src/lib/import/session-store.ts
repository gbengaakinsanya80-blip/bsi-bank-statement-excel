import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { XlsxCell } from "@/lib/import/xlsx-reader";
import { autoMapColumns, type ColumnMapping } from "@/lib/import/mapping";

export interface ImportSession {
  id: string;
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: XlsxCell[][];
  mapping: ColumnMapping[];
  createdAt: string;
}

const SESSIONS_DIR = path.join(os.tmpdir(), "worldmark-import-sessions");

let chain: Promise<unknown> = Promise.resolve();

async function write(id: string, session: ImportSession): Promise<void> {
  chain = chain.then(async () => {
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(SESSIONS_DIR, `${id}.json`),
      JSON.stringify(session, null, 2),
      "utf8"
    );
  });
  await chain;
}

export async function createImportSession(input: {
  fileName: string;
  sheetName: string;
  headers: string[];
  rows: XlsxCell[][];
}): Promise<ImportSession> {
  const session: ImportSession = {
    id: `imp-${Date.now()}`,
    fileName: input.fileName,
    sheetName: input.sheetName,
    headers: input.headers,
    rows: input.rows,
    mapping: autoMapColumns(input.headers),
    createdAt: new Date().toISOString(),
  };
  await write(session.id, session);
  return session;
}

export async function getImportSession(id: string): Promise<ImportSession | null> {
  try {
    const raw = await fs.readFile(path.join(SESSIONS_DIR, `${id}.json`), "utf8");
    return JSON.parse(raw) as ImportSession;
  } catch {
    return null;
  }
}

export async function updateImportSession(
  id: string,
  patch: Partial<Pick<ImportSession, "mapping">>
): Promise<ImportSession | null> {
  const session = await getImportSession(id);
  if (!session) return null;
  const next: ImportSession = { ...session, ...patch };
  await write(id, next);
  return next;
}
