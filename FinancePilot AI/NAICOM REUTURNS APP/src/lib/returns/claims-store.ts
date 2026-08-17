import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { ClaimSource } from "@/lib/returns/types";

const STORE_PATH = path.join(os.tmpdir(), "worldmark-demo-claims.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function loadStore(): Promise<Record<string, ClaimSource>> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as Record<string, ClaimSource>;
  } catch {
    return {};
  }
}

async function saveStore(map: Record<string, ClaimSource>): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(map, null, 2), "utf8");
  });
  await writeChain;
}

export async function addClaim(claim: Omit<ClaimSource, "id">): Promise<ClaimSource> {
  const store = await loadStore();
  const id = `claim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const entry: ClaimSource = { ...claim, id };
  store[id] = entry;
  await saveStore(store);
  return entry;
}

export async function updateClaim(id: string, patch: Partial<ClaimSource>): Promise<boolean> {
  const store = await loadStore();
  const existing = store[id];
  if (!existing) return false;
  store[id] = { ...existing, ...patch, id };
  await saveStore(store);
  return true;
}

export async function deleteClaim(id: string): Promise<boolean> {
  const store = await loadStore();
  if (!store[id]) return false;
  delete store[id];
  await saveStore(store);
  return true;
}

export async function settleClaim(id: string, datePayment: string): Promise<boolean> {
  return updateClaim(id, { date_payment: datePayment });
}

export async function listAllClaims(): Promise<ClaimSource[]> {
  const store = await loadStore();
  return Object.values(store).sort((a, b) =>
    (a.date_notified_by_insured ?? "").localeCompare(b.date_notified_by_insured ?? "")
  );
}

/**
 * Returns claims relevant to a given quarter:
 * 1. Claims notified in or before this quarter AND not yet settled (rollover)
 * 2. Claims notified in this quarter (even if settled)
 */
export function claimsForPeriod(claims: ClaimSource[], periodEnd: string): ClaimSource[] {
  return claims.filter((c) => {
    const notified = c.date_notified_to_insurer;
    if (!notified) return false;
    if (notified <= periodEnd) return true;
    return false;
  });
}
