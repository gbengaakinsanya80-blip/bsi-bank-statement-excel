import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Client, Insurer, Staff } from "@/lib/types/database";
import {
  demoClients,
  demoInsurers,
  demoStaff,
  demoStaffCategories,
} from "@/lib/demo/data";

export interface StoredStaff extends Staff {
  staff_categories: { name: string } | null;
}

interface DemoMasterStore {
  clients: Record<string, Client>;
  insurers: Record<string, Insurer>;
  staff: Record<string, Staff>;
  deletedClients: string[];
  deletedInsurers: string[];
  deletedStaff: string[];
}

const STORE_PATH = process.env.WORLDMARK_MASTER_STORE_PATH
  ? path.resolve(process.env.WORLDMARK_MASTER_STORE_PATH)
  : path.join(os.tmpdir(), "worldmark-demo-masters.json");

let writeChain: Promise<unknown> = Promise.resolve();

function emptyStore(): DemoMasterStore {
  return {
    clients: {},
    insurers: {},
    staff: {},
    deletedClients: [],
    deletedInsurers: [],
    deletedStaff: [],
  };
}

async function loadStore(): Promise<DemoMasterStore> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    return { ...emptyStore(), ...(JSON.parse(raw) as DemoMasterStore) };
  } catch {
    return emptyStore();
  }
}

async function saveStore(store: DemoMasterStore): Promise<void> {
  writeChain = writeChain.then(async () => {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
  });
  await writeChain;
}

export async function upsertDemoClient(client: Client): Promise<void> {
  const store = await loadStore();
  store.clients[client.id] = client;
  await saveStore(store);
}

export async function deleteDemoClient(id: string): Promise<void> {
  const store = await loadStore();
  delete store.clients[id];
  if (!store.deletedClients.includes(id)) store.deletedClients.push(id);
  await saveStore(store);
}

export async function upsertDemoInsurer(insurer: Insurer): Promise<void> {
  const store = await loadStore();
  store.insurers[insurer.id] = insurer;
  await saveStore(store);
}

export async function deleteDemoInsurer(id: string): Promise<void> {
  const store = await loadStore();
  delete store.insurers[id];
  if (!store.deletedInsurers.includes(id)) store.deletedInsurers.push(id);
  await saveStore(store);
}

export async function upsertDemoStaff(staff: Staff): Promise<void> {
  const store = await loadStore();
  store.staff[staff.id] = staff;
  await saveStore(store);
}

export async function deleteDemoStaff(id: string): Promise<void> {
  const store = await loadStore();
  delete store.staff[id];
  if (!store.deletedStaff.includes(id)) store.deletedStaff.push(id);
  await saveStore(store);
}

export async function listDemoClients(): Promise<Client[]> {
  const store = await loadStore();
  const base = demoClients.map((c) => store.clients[c.id] ?? c);
  const added = Object.values(store.clients).filter(
    (c) => !demoClients.some((d) => d.id === c.id)
  );
  const removed = new Set(store.deletedClients);
  return [...added, ...base]
    .filter((c) => !removed.has(c.id))
    .sort((a, b) => a.client_name.localeCompare(b.client_name));
}

export async function listDemoInsurers(): Promise<Insurer[]> {
  const store = await loadStore();
  const base = demoInsurers.map((i) => store.insurers[i.id] ?? i);
  const added = Object.values(store.insurers).filter(
    (i) => !demoInsurers.some((d) => d.id === i.id)
  );
  const removed = new Set(store.deletedInsurers);
  return [...added, ...base]
    .filter((i) => !removed.has(i.id))
    .sort((a, b) => a.insurer_name.localeCompare(b.insurer_name));
}

export async function listDemoStaff(): Promise<StoredStaff[]> {
  const store = await loadStore();
  const base = demoStaff.map((s) => store.staff[s.id] ?? s);
  const added = Object.values(store.staff).filter(
    (s) => !demoStaff.some((d) => d.id === s.id)
  );
  const removed = new Set(store.deletedStaff);
  return [...added, ...base]
    .filter((s) => !removed.has(s.id))
    .map((s) => ({
      ...s,
      staff_categories:
        demoStaffCategories.find((c) => c.id === s.staff_category_id) ?? null,
    }))
    .sort((a, b) => a.staff_name.localeCompare(b.staff_name));
}

export async function getDemoClient(id: string): Promise<Client | null> {
  const list = await listDemoClients();
  return list.find((c) => c.id === id) ?? null;
}

export async function getDemoInsurer(id: string): Promise<Insurer | null> {
  const list = await listDemoInsurers();
  return list.find((i) => i.id === id) ?? null;
}

export async function getDemoStaff(id: string): Promise<StoredStaff | null> {
  const list = await listDemoStaff();
  return list.find((s) => s.id === id) ?? null;
}
