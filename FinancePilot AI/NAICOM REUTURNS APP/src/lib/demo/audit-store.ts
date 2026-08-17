import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { AuditLog } from "@/lib/types/database";

const STORE_PATH = process.env.WORLDMARK_AUDIT_STORE_PATH
  ? path.resolve(process.env.WORLDMARK_AUDIT_STORE_PATH)
  : path.join(os.tmpdir(), "worldmark-demo-audit.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function loadStore(): Promise<AuditLog[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as AuditLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveStore(entries: AuditLog[]): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(entries, null, 2), "utf8");
  });
  await writeChain;
}

export async function appendDemoAudit(entry: AuditLog): Promise<void> {
  const entries = await loadStore();
  entries.push(entry);
  const kept = entries.slice(-1000);
  await saveStore(kept);
}

export async function listDemoAudit(limit = 100): Promise<AuditLog[]> {
  const entries = await loadStore();
  return entries
    .slice()
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, limit);
}
