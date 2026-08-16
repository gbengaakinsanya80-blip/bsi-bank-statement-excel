import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getReturnDefinition } from "@/lib/returns/definitions";
import type { ReturnPeriod } from "@/lib/returns/periods";
import type {
  ReturnInstanceSummary,
  ReturnInstanceView,
  ReturnRow,
  ReturnTotal,
} from "@/lib/returns/types";
import { computeReturnTotals } from "@/lib/returns/columns";
import { validateReturn } from "@/lib/compliance/validation";

export interface StoredDemoReturn {
  id: string;
  code: string;
  period: ReturnPeriod;
  status: string;
  versionNo: number;
  createdAt: string;
  amendedAt: string | null;
  rows: ReturnRow[];
}

const STORE_PATH = path.join(os.tmpdir(), "worldmark-demo-returns.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function loadStore(): Promise<Record<string, StoredDemoReturn>> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as Record<string, StoredDemoReturn>;
  } catch {
    return {};
  }
}

async function saveStore(map: Record<string, StoredDemoReturn>): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(map, null, 2), "utf8");
  });
  await writeChain;
}

export async function upsertDemoReturn(
  code: string,
  period: ReturnPeriod,
  rows: ReturnRow[]
): Promise<{ id: string; existing: boolean; version: number }> {
  const store = await loadStore();
  const existing = Object.values(store).find(
    (r) => r.code === code && r.period.key === period.key
  );
  if (existing) {
    existing.rows = rows;
    existing.versionNo += 1;
    existing.status = "DRAFT";
    existing.amendedAt = new Date().toISOString();
    await saveStore(store);
    return { id: existing.id, existing: true, version: existing.versionNo };
  }

  const id = `demo-${code.toLowerCase().replace(/_/g, "-")}-${Date.now()}`;
  store[id] = {
    id,
    code,
    period,
    status: "DRAFT",
    versionNo: 1,
    createdAt: new Date().toISOString(),
    amendedAt: null,
    rows,
  };
  await saveStore(store);
  return { id, existing: false, version: 1 };
}

export async function updateDemoReturnStatus(id: string, status: string): Promise<boolean> {
  const store = await loadStore();
  const record = store[id];
  if (!record) return false;
  record.status = status;
  await saveStore(store);
  return true;
}

export async function getDemoReturn(id: string): Promise<StoredDemoReturn | null> {
  const store = await loadStore();
  return store[id] ?? null;
}

export async function listDemoReturns(): Promise<StoredDemoReturn[]> {
  const store = await loadStore();
  return Object.values(store).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function demoReturnSummary(r: StoredDemoReturn): ReturnInstanceSummary {
  const def = getReturnDefinition(r.code);
  return {
    id: r.id,
    code: r.code,
    name: def.name,
    formNumber: def.formNumber,
    frequency: def.frequency,
    department: def.department,
    periodLabel: r.period.label,
    periodStart: r.period.start,
    periodEnd: r.period.end,
    status: r.status,
    createdAt: r.createdAt,
    rowCount: r.rows.length,
    versionNo: r.versionNo,
    qualityScore: validateReturn(r.code, r.rows).score,
  };
}

export function demoReturnTotals(code: string, rows: ReturnRow[]): ReturnTotal[] {
  return computeReturnTotals(code, rows);
}

export async function getDemoReturnView(id: string): Promise<ReturnInstanceView | null> {
  const r = await getDemoReturn(id);
  if (!r) return null;
  const def = getReturnDefinition(r.code);
  return {
    id: r.id,
    code: r.code,
    name: def.name,
    formNumber: def.formNumber,
    frequency: def.frequency,
    department: def.department,
    periodKey: r.period.key,
    periodLabel: r.period.label,
    periodStart: r.period.start,
    periodEnd: r.period.end,
    status: r.status,
    createdAt: r.createdAt,
    rowCount: r.rows.length,
    versionNo: r.versionNo,
    rows: r.rows,
    totals: demoReturnTotals(r.code, r.rows),
    quality: validateReturn(r.code, r.rows),
  };
}
