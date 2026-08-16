import { describe, expect, it } from "vitest";
import {
  runReconciliation,
  type ReconciliationInput,
  type ReconciliationReturnLike,
} from "@/lib/compliance/reconciliation";
import type { PolicySource } from "@/lib/returns/types";

function makePolicy(p: Partial<PolicySource>): PolicySource {
  return {
    id: "p-x",
    transaction_reference: null,
    policy_number: "WMK/2026/0001",
    endorsement_number: null,
    transaction_type: "NEW",
    risk_type: null,
    class_of_business: null,
    insured_name: "ADEWALE & CO",
    client_name: null,
    insurer_name: null,
    broker_or_agent: null,
    ledger_account: null,
    sum_insured: null,
    currency: "NGN",
    gross_premium: null,
    premium_collected: null,
    premium_paid_to_insurer: null,
    brokerage_commission: null,
    commission_rate: null,
    tax: null,
    other_deductions: null,
    net_premium: null,
    amount_received: null,
    receipt_number: null,
    debit_note_number: null,
    credit_note_number: null,
    transaction_date: null,
    cover_from: null,
    cover_to: null,
    premium_collection_date: null,
    premium_payment_date: null,
    branch_location: null,
    remarks: null,
    bank_name: null,
    cheque_number: null,
    ...p,
  };
}

function makeReturn(
  id: string,
  code: string,
  rows: Record<string, unknown>[],
  period = "2026-01-01_to_2026-12-31"
): ReconciliationReturnLike {
  return {
    id,
    code,
    periodKey: period,
    periodStart: period.slice(0, 10),
    periodEnd: period.slice(14),
    status: "APPROVED",
    rows,
  };
}

function resultFor(input: ReconciliationInput, ruleId: string) {
  const result = runReconciliation(input).find((r) => r.ruleId === ruleId)!;
  expect(result).toBeDefined();
  return result;
}

describe("reconciliation engine", () => {
  it("reports OK when CRR commission matches Income Production", () => {
    const input: ReconciliationInput = {
      returns: [
        makeReturn("r-crr", "CRR", [{ policy_no: "P1", client: "A", brokerage_commission: 900 }], "2026-01-01_to_2026-03-31"),
        makeReturn("r-ip", "INCOME_PRODUCTION", [
          { policy_no: "P1", assured: "A", brokerage: 900 },
          { policy_no: "P2", assured: "B", brokerage: 0 },
        ]),
      ],
      policies: [],
    };
    const result = resultFor(input, "commission");
    expect(result.status).toBe("OK");
    expect(result.valueA).toBe(900);
    expect(result.valueB).toBe(900);
    expect(result.linkA).toBe("r-crr");
    expect(result.linkB).toBe("r-ip");
  });

  it("flags a commission difference as a warning with a message", () => {
    const input: ReconciliationInput = {
      returns: [
        makeReturn("r-crr", "CRR", [{ policy_no: "P1", client: "A", brokerage_commission: 1000 }], "2026-01-01_to_2026-03-31"),
        makeReturn("r-ip", "INCOME_PRODUCTION", [{ policy_no: "P1", assured: "A", brokerage: 900 }]),
      ],
      policies: [],
    };
    const result = resultFor(input, "commission");
    expect(result.status).toBe("WARNING");
    expect(result.difference).toBe(100);
    expect(result.message).toContain("Difference");
  });

  it("marks rules as N/A when one side is not generated", () => {
    const input: ReconciliationInput = {
      returns: [makeReturn("r-crr", "CRR", [{ policy_no: "P1", client: "A", brokerage_commission: 900 }])],
      policies: [],
    };
    const result = resultFor(input, "commission");
    expect(result.status).toBe("N/A");
  });

  it("reports OK when the commission register reconciles with CRR", () => {
    const input: ReconciliationInput = {
      returns: [
        makeReturn("r-reg", "BROKERAGE_COMMISSION", [
          { policy_no: "P1", client: "A", commission_earned: 900 },
          { policy_no: "P2", client: "B", commission_earned: 0 },
        ], "2026-01-01_to_2026-12-31"),
        makeReturn("r-crr", "CRR", [{ policy_no: "P1", client: "A", brokerage_commission: 900 }]),
      ],
      policies: [],
    };
    const result = resultFor(input, "commission_register");
    expect(result.status).toBe("OK");
    expect(result.valueA).toBe(900);
    expect(result.valueB).toBe(900);
    expect(result.linkA).toBe("r-reg");
    expect(result.linkB).toBe("r-crr");
  });

  it("flags a register vs CRR difference as a warning", () => {
    const input: ReconciliationInput = {
      returns: [
        makeReturn("r-reg", "BROKERAGE_COMMISSION", [
          { policy_no: "P1", client: "A", commission_earned: 1_000 },
        ], "2026-01-01_to_2026-12-31"),
        makeReturn("r-crr", "CRR", [{ policy_no: "P1", client: "A", brokerage_commission: 900 }]),
      ],
      policies: [],
    };
    const result = resultFor(input, "commission_register");
    expect(result.status).toBe("WARNING");
    expect(result.difference).toBe(100);
  });

  it("treats the register rule as N/A when the register is not generated", () => {
    const input: ReconciliationInput = {
      returns: [makeReturn("r-crr", "CRR", [{ policy_no: "P1", client: "A", brokerage_commission: 900 }])],
      policies: [],
    };
    expect(resultFor(input, "commission_register").status).toBe("N/A");
  });

  it("reports OK when Businesses Generated gross matches Income Production", () => {
    const input: ReconciliationInput = {
      returns: [
        makeReturn("r-biz", "BUSINESSES_GENERATED", [{ insured: "A", gp_ngn: 10_000 }]),
        makeReturn("r-ip", "INCOME_PRODUCTION", [
          { policy_no: "P1", assured: "A", gross_premium: 6_000 },
          { policy_no: "P2", assured: "B", gross_premium: 4_000 },
        ]),
      ],
      policies: [],
    };
    const result = resultFor(input, "premium");
    expect(result.status).toBe("OK");
  });

  it("reconciles Form 1C totals against the underlying policies in its period", () => {
    const input: ReconciliationInput = {
      returns: [
        makeReturn(
          "r-f1c",
          "FORM_1C",
          [
            { insurer: "AXA", gross_premium: 1_500 },
            { insurer: "Leadway", gross_premium: 2_000 },
          ],
          "2026-01-01_to_2026-06-30"
        ),
      ],
      policies: [
        makePolicy({ policy_number: "P1", transaction_date: "2026-02-01", gross_premium: 1_500 }),
        makePolicy({ policy_number: "P2", transaction_date: "2026-05-01", gross_premium: 2_000 }),
        makePolicy({ policy_number: "P3", transaction_date: "2026-08-01", gross_premium: 9_999 }),
      ],
    };
    const result = resultFor(input, "form1c");
    expect(result.status).toBe("OK");
    expect(result.valueB).toBe(3_500);
  });

  it("validates commission against rate per policy and drills down mismatches", () => {
    const input: ReconciliationInput = {
      returns: [],
      policies: [
        makePolicy({ policy_number: "P1", gross_premium: 10_000, commission_rate: 9, brokerage_commission: 900 }),
        makePolicy({ policy_number: "P2", gross_premium: 10_000, commission_rate: 9, brokerage_commission: 1_500 }),
      ],
    };
    const result = resultFor(input, "rate");
    expect(result.status).toBe("WARNING");
    expect(result.drilldown).toHaveLength(1);
    expect(result.drilldown[0].policyNo).toBe("P2");
  });

  it("treats collections and remittances as N/A in preview data", () => {
    const input: ReconciliationInput = { returns: [], policies: [] };
    expect(resultFor(input, "collection").status).toBe("N/A");
    expect(resultFor(input, "remittance").status).toBe("N/A");
  });
});
