import { describe, expect, it } from "vitest";
import type { Client, Insurer, Staff } from "@/lib/types/database";
import {
  upsertDemoClient,
  deleteDemoClient,
  listDemoClients,
  upsertDemoInsurer,
  deleteDemoInsurer,
  listDemoInsurers,
  upsertDemoStaff,
  deleteDemoStaff,
  listDemoStaff,
} from "@/lib/demo/master-store";
import { demoClients, demoInsurers } from "@/lib/demo/data";

function makeClient(overrides: Partial<Client> = {}): Client {
  const now = new Date().toISOString();
  const id = `demo-client-test-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    client_name: `Test Client ${id}`,
    address: null,
    phone: null,
    email: null,
    contact_person: null,
    industry: "Test",
    status: "ACTIVE",
    is_demo: true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeInsurer(overrides: Partial<Insurer> = {}): Insurer {
  const now = new Date().toISOString();
  const id = `demo-insurer-test-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    insurer_name: `Test Insurer ${id}`,
    naicom_code: null,
    address: null,
    contact: null,
    email: null,
    active: true,
    is_demo: true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  const now = new Date().toISOString();
  const id = `demo-staff-test-${Math.random().toString(36).slice(2)}`;
  return {
    id,
    staff_name: `Test Staff ${id}`,
    staff_category_id: "sc-sr",
    designation: "Officer",
    gender: "MALE",
    educational_qualification: null,
    professional_qualification: null,
    date_of_employment: "2026-01-01",
    state_of_origin: null,
    location: "Lagos",
    date_of_exit: null,
    reason_for_leaving: null,
    is_demo: true,
    deleted_at: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

describe("demo master store", () => {
  it("persists new clients, insurers and staff and merges them into the lists", async () => {
    const client = makeClient({ client_name: "Aaa New Client" });
    const insurer = makeInsurer({ insurer_name: "Aaa New Insurer" });
    const staff = makeStaff({ staff_name: "Aaa New Staff" });

    await upsertDemoClient(client);
    await upsertDemoInsurer(insurer);
    await upsertDemoStaff(staff);

    expect((await listDemoClients()).some((c) => c.id === client.id)).toBe(true);
    expect((await listDemoInsurers()).some((i) => i.id === insurer.id)).toBe(true);

    const staffList = await listDemoStaff();
    const stored = staffList.find((s) => s.id === staff.id);
    expect(stored).toBeDefined();
    expect(stored?.staff_categories?.name).toBe("SENIOR STAFF");
  });

  it("allows editing a built-in demo record by id", async () => {
    const base = demoClients[0];
    await upsertDemoClient(makeClient({ id: base.id, client_name: "Renamed Client" }));

    const list = await listDemoClients();
    const edited = list.find((c) => c.id === base.id);
    expect(edited?.client_name).toBe("Renamed Client");
  });

  it("removes deleted records from the lists", async () => {
    const client = makeClient();
    await upsertDemoClient(client);
    await deleteDemoClient(client.id);
    expect((await listDemoClients()).some((c) => c.id === client.id)).toBe(false);

    const insurer = makeInsurer();
    await upsertDemoInsurer(insurer);
    await deleteDemoInsurer(insurer.id);
    expect((await listDemoInsurers()).some((i) => i.id === insurer.id)).toBe(false);

    const staff = makeStaff();
    await upsertDemoStaff(staff);
    await deleteDemoStaff(staff.id);
    expect((await listDemoStaff()).some((s) => s.id === staff.id)).toBe(false);
  });

  it("keeps the original built-in demo data intact", async () => {
    const clients = await listDemoClients();
    for (const base of demoClients) {
      expect(clients.some((c) => c.id === base.id)).toBe(true);
    }
    expect((await listDemoInsurers()).length).toBeGreaterThanOrEqual(demoInsurers.length);
  });
});
