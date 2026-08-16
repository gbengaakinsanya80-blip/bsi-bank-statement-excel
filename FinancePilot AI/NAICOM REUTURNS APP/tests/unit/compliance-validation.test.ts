import { describe, expect, it } from "vitest";
import { validateReturn } from "@/lib/compliance/validation";

function crrRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    policy_no: "WMK/2026/0001",
    date: "2026-01-17",
    client: "ADEWALE & CO",
    insurer: "AXA Mansard",
    sum_insured: 1_000_000,
    gross_premium: 10_000,
    approved_rate: 9,
    tax_paid: 0,
    net_rate: 9,
    brokerage_commission: 900,
    other_deduction: 0,
    net_premium: 9_100,
    amount_received: 10_000,
    ...overrides,
  };
}

function registerRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    client: "ADEWALE & CO",
    insurer: "AXA Mansard",
    policy_no: "WMK/2026/0001",
    class_of_business: "MARINE",
    date: "2026-05-11",
    sum_insured: 50_000_000,
    gross_premium: 750_000,
    commission_rate: 10,
    commission_earned: 75_000,
    withholding_tax: 7_500,
    net_commission: 67_500,
    date_received: "2026-06-01",
    receipt_no: "RCV/2026/88",
    ...overrides,
  };
}

describe("validateReturn", () => {
  it("scores a clean return at 100 with no issues", () => {
    const result = validateReturn("CRR", [crrRow(), crrRow({ policy_no: "WMK/2026/0002" })]);
    expect(result.hasErrors).toBe(false);
    expect(result.score).toBe(100);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("flags missing required fields as errors", () => {
    const result = validateReturn("CRR", [crrRow({ client: null })]);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.code === "MISSING_FIELD" && i.field === "client")).toBe(true);
  });

  it("flags negative amounts as errors", () => {
    const result = validateReturn("CRR", [crrRow({ gross_premium: -500 })]);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.code === "NEGATIVE_AMOUNT")).toBe(true);
  });

  it("flags invalid dates as errors", () => {
    const result = validateReturn("CRR", [crrRow({ date: "not-a-date" })]);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.code === "INVALID_DATE")).toBe(true);
  });

  it("flags duplicate policy numbers as errors", () => {
    const result = validateReturn("CRR", [crrRow(), crrRow()]);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.code === "DUPLICATE_POLICY")).toBe(true);
  });

  it("warns when collection exceeds expected premium", () => {
    const result = validateReturn("CRR", [
      crrRow({ premium_collected: 12_000, gross_premium: 10_000 }),
    ]);
    expect(result.hasErrors).toBe(false);
    expect(result.issues.some((i) => i.code === "COLLECTION_EXCEEDS_EXPECTED")).toBe(true);
  });

  it("warns when premium paid exceeds premium collected", () => {
    const result = validateReturn("CRR", [
      crrRow({ premium_collected: 9_000, premium_paid_to_insurer: 9_500 }),
    ]);
    expect(result.hasErrors).toBe(false);
    expect(result.issues.some((i) => i.code === "PAID_EXCEEDS_COLLECTED")).toBe(true);
  });

  it("warns when commission is inconsistent with the approved rate", () => {
    const result = validateReturn("CRR", [crrRow({ brokerage_commission: 1_000 })]);
    expect(result.hasErrors).toBe(false);
    expect(result.issues.some((i) => i.code === "COMMISSION_INCONSISTENT_WITH_RATE")).toBe(true);
  });

  it("flags reversed cover periods as errors", () => {
    const result = validateReturn("CRR", [crrRow({ cover_from: "2026-12-31", cover_to: "2026-01-01" })]);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.code === "IMPLAUSIBLE_RANGE")).toBe(true);
  });

  it("informs on fully blank rows without failing the score", () => {
    const result = validateReturn("CRR", [crrRow(), { other: undefined }]);
    expect(result.issues.some((i) => i.code === "BLANK_ROW" && i.severity === "INFO")).toBe(true);
  });

  it("validates personnel headcount arithmetic as a warning", () => {
    const rows = [
      { schedule: "SECOND", category: "SENIOR STAFF", previous: 2, entry: 1, exit: 1, current: 3 },
    ];
    const result = validateReturn("PERSONNEL", rows);
    expect(result.hasErrors).toBe(false);
    expect(result.issues.some((i) => i.code === "PERSONNEL_HEADCOUNT_DISCREPANCY")).toBe(true);
  });

  it("blocks on errors with a reduced score", () => {
    const result = validateReturn("CRR", [crrRow({ client: null }), crrRow()]);
    expect(result.hasErrors).toBe(true);
    expect(result.score).toBeLessThan(100);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("scores a clean brokerage commission register at 100", () => {
    const result = validateReturn("BROKERAGE_COMMISSION", [registerRow(), registerRow({ policy_no: "WMK/2026/0002" })]);
    expect(result.hasErrors).toBe(false);
    expect(result.score).toBe(100);
  });

  it("flags missing required fields on the commission register", () => {
    const result = validateReturn("BROKERAGE_COMMISSION", [registerRow({ commission_earned: null })]);
    expect(result.hasErrors).toBe(true);
    expect(result.issues.some((i) => i.code === "MISSING_FIELD" && i.field === "commission_earned")).toBe(true);
  });

  it("warns when net commission disagrees with commission earned minus WHT", () => {
    const result = validateReturn("BROKERAGE_COMMISSION", [registerRow({ net_commission: 50_000 })]);
    expect(result.hasErrors).toBe(false);
    expect(result.issues.some((i) => i.code === "NET_COMMISSION_DISCREPANCY")).toBe(true);
  });

  it("warns when commission is inconsistent with the register rate", () => {
    const result = validateReturn("BROKERAGE_COMMISSION", [registerRow({ commission_earned: 100_000, net_commission: 92_500 })]);
    expect(result.hasErrors).toBe(false);
    expect(result.issues.some((i) => i.code === "COMMISSION_INCONSISTENT_WITH_RATE")).toBe(true);
  });
});
