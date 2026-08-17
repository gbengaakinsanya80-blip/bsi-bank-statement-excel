import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { TrainingRecord } from "@/lib/types/database";

interface TrainingStore {
  records: Record<string, TrainingRecord>;
}

const STORE_PATH =
  process.env.WORLDMARK_TRAINING_STORE_PATH ??
  path.join(os.tmpdir(), "worldmark-demo-training.json");

let writeChain: Promise<unknown> = Promise.resolve();

function emptyStore(): TrainingStore {
  return { records: {} };
}

async function loadStore(): Promise<TrainingStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return { ...emptyStore(), ...(JSON.parse(raw) as TrainingStore) };
  } catch {
    return emptyStore();
  }
}

async function saveStore(store: TrainingStore): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
}

export async function listDemoTrainingRecords(): Promise<TrainingRecord[]> {
  const store = await loadStore();
  return Object.values(store.records)
    .filter((r) => !r.deleted_at)
    .sort((a, b) => (b.training_date ?? "").localeCompare(a.training_date ?? ""));
}

export async function getDemoTrainingRecord(
  id: string
): Promise<TrainingRecord | null> {
  const store = await loadStore();
  const record = store.records[id];
  return record && !record.deleted_at ? record : null;
}

export async function upsertDemoTrainingRecord(
  record: TrainingRecord
): Promise<void> {
  const store = await loadStore();
  store.records[record.id] = record;
  await saveStore(store);
}

export async function deleteDemoTrainingRecord(id: string): Promise<void> {
  const store = await loadStore();
  const record = store.records[id];
  if (record) {
    store.records[id] = {
      ...record,
      deleted_at: new Date().toISOString(),
    };
    await saveStore(store);
  }
}
