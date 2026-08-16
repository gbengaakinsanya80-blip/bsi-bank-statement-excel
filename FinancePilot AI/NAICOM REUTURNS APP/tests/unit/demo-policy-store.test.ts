import { describe, expect, it } from "vitest";
import { saveStoredDemoPolicy, listStoredDemoPolicies } from "@/lib/demo/policy-store";
import { demoPoliciesForTable } from "@/lib/demo/data";
import { demoPolicySources } from "@/lib/demo/policy-sources";
import type { StoredDemoPolicy } from "@/lib/demo/policy-store";

function makeStoredPolicy(overrides: Partial<StoredDemoPolicy> = {}): StoredDemoPolicy {
  const now = new Date().toISOString();
  return {
    id: `demo-policy-test-${Math.random().toString(36).slice(2)}`,
    transaction_reference: "TRX-WMK/2026/9999",
    policy_number: "WMK/2026/9999",
    endorsement_number: null,
    transaction_type: "NEW",
    new_or_renewal: "NEW",
    risk_type: "Fire",
    class_of_business: "Fire",
    client_id: "cl-zenith",
    insured_name: "Test Insured",
    insurer_id: "in-axa",
    broker_or_agent: null,
    ledger_account: null,
    sum_insured: "1000000.00",
    currency: "NGN",
    gross_premium: "50000.00",
    premium_collected: "50000.00",
    premium_paid_to_insurer: "43750.00",
    brokerage_commission: "6250.00",
    commission_rate: "12.50",
    tax: "0.00",
    other_deductions: "0.00",
    net_premium: "43750.00",
    amount_received: "50000.00",
    receipt_number: null,
    debit_note_number: null,
    credit_note_number: null,
    transaction_date: "2026-08-01",
    cover_from: "2026-08-01",
    cover_to: "2027-07-31",
    premium_collection_date: "2026-08-01",
    premium_payment_date: "2026-08-01",
    branch_location: "Lagos",
    remarks: null,
    status: "ACTIVE",
    is_demo: true,
    created_by: "00000000-0000-0000-0000-000000000000",
    deleted_at: null,
    created_at: now,
    updated_at: now,
    clients: { client_name: "Zenith Bank Plc" },
    insurers: { insurer_name: "AXA Mansard Insurance Plc" },
    ...overrides,
  };
}

describe("demo policy store", () => {
  it("persists a saved policy and surfaces it in the table and return sources", async () => {
    const policy = makeStoredPolicy();
    await saveStoredDemoPolicy(policy);

    const listed = await listStoredDemoPolicies();
    expect(listed.some((p) => p.id === policy.id)).toBe(true);

    const table = await demoPoliciesForTable();
    const inTable = table.find((p) => p.id === policy.id);
    expect(inTable).toBeDefined();
    expect(inTable?.clients?.client_name).toBe("Zenith Bank Plc");

    const sources = await demoPolicySources();
    const inSources = sources.find((p) => p.id === policy.id);
    expect(inSources).toBeDefined();
    expect(inSources?.gross_premium).toBe(50000);
    expect(inSources?.client_name).toBe("Zenith Bank Plc");
  });
});
