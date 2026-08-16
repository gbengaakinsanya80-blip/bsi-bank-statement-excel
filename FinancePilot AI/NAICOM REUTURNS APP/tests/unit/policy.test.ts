import { describe, expect, it } from "vitest";
import { coerceDates, policySchema, toPolicyRow } from "@/lib/services/policy-service";

describe("policySchema", () => {
  it("accepts a valid minimal policy", () => {
    const res = policySchema.safeParse({ policy_number: "WMK/2026/0001" });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.transaction_type).toBe("NEW");
      expect(res.data.currency).toBe("NGN");
    }
  });

  it("rejects a missing policy number", () => {
    const res = policySchema.safeParse({});
    expect(res.success).toBe(false);
  });

  it("rejects negative premiums", () => {
    const res = policySchema.safeParse({ policy_number: "P1", gross_premium: -5 });
    expect(res.success).toBe(false);
  });

  it("rejects an invalid transaction type", () => {
    const res = policySchema.safeParse({ policy_number: "P1", transaction_type: "FROBNICATE" });
    expect(res.success).toBe(false);
  });
});

describe("coerceDates", () => {
  it("converts empty date strings to null", () => {
    const out = coerceDates({ transaction_date: "", cover_from: "2026-01-01" });
    expect(out.transaction_date).toBeNull();
    expect(out.cover_from).toBe("2026-01-01");
  });
});

describe("toPolicyRow", () => {
  it("maps empty money fields to null", () => {
    const parsed = policySchema.parse({ policy_number: "P1" });
    const row = toPolicyRow(parsed, "user-1");
    expect(row.created_by).toBe("user-1");
    expect(row.gross_premium).toBeNull();
    expect(row.sum_insured).toBeNull();
  });
});
