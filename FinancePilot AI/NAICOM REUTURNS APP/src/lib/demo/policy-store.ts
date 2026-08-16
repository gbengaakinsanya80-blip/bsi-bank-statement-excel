import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Policy } from "@/lib/types/database";

export interface StoredDemoPolicy extends Policy {
  clients: { client_name: string } | null;
  insurers: { insurer_name: string } | null;
}

const STORE_PATH =
  process.env.WORLDMARK_POLICY_STORE_PATH ??
  path.join(os.tmpdir(), "worldmark-demo-policies.json");

let writeChain: Promise<unknown> = Promise.resolve();

async function loadStore(): Promise<Record<string, StoredDemoPolicy>> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return JSON.parse(raw) as Record<string, StoredDemoPolicy>;
  } catch {
    return {};
  }
}

async function saveStore(map: Record<string, StoredDemoPolicy>): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(map, null, 2), "utf8");
  });
  await writeChain;
}

export async function listStoredDemoPolicies(): Promise<StoredDemoPolicy[]> {
  const store = await loadStore();
  return Object.values(store).sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function saveStoredDemoPolicy(
  policy: StoredDemoPolicy
): Promise<StoredDemoPolicy> {
  const store = await loadStore();
  store[policy.id] = policy;
  await saveStore(store);
  return policy;
}
