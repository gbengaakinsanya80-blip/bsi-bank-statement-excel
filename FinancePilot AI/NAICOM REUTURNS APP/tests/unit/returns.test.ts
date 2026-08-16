import { describe, expect, it } from "vitest";
import {
  adHocPeriod,
  annualPeriod,
  buildPeriod,
  halfYearlyPeriod,
  monthlyPeriod,
  periodsForFrequency,
  quarterlyPeriod,
} from "@/lib/returns/periods";
import {
  buildBrokerageCommissionRows,
  buildBusinessesGeneratedRows,
  buildCrrRows,
  buildForm1CRows,
  buildIncomeProductionRows,
  buildPersonnelRows,
} from "@/lib/returns/builders";
import { computeReturnTotals } from "@/lib/returns/columns";
import type { PolicySource, ReturnData, StaffSource } from "@/lib/returns/types";

function makePolicy(p: Partial<PolicySource>): PolicySource {
  return {
    id: "p-x",
    transaction_reference: null,
    policy_number: null,
    endorsement_number: null,
    transaction_type: "NEW",
    risk_type: null,
    class_of_business: null,
    insured_name: null,
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

function makeStaff(s: Partial<StaffSource>): StaffSource {
  return {
    id: "s-x",
    staff_name: "Test Staff",
    staff_category: null,
    designation: null,
    gender: null,
    educational_qualification: null,
    professional_qualification: null,
    date_of_employment: null,
    state_of_origin: null,
    location: null,
    date_of_exit: null,
    reason_for_leaving: null,
    ...s,
  };
}

describe("period helpers", () => {
  it("builds a monthly period incl. leap-year end", () => {
    const feb = monthlyPeriod(2024, 2);
    expect(feb.key).toBe("2024-02");
    expect(feb.start).toBe("2024-02-01");
    expect(feb.end).toBe("2024-02-29");

    const jun = monthlyPeriod(2026, 6);
    expect(jun.end).toBe("2026-06-30");
  });

  it("builds quarterly periods", () => {
    const q1 = quarterlyPeriod(2026, 1);
    expect(q1.key).toBe("2026-Q1");
    expect(q1.start).toBe("2026-01-01");
    expect(q1.end).toBe("2026-03-31");
  });

  it("builds half-yearly periods", () => {
    const h1 = halfYearlyPeriod(2026, "H1");
    expect(h1.end).toBe("2026-06-30");
    const fy = halfYearlyPeriod(2026, "FY");
    expect(fy.label).toBe("Full Year 2026");
    expect(fy.end).toBe("2026-12-31");
  });

  it("builds annual periods", () => {
    const year = annualPeriod(2026);
    expect(year.key).toBe("2026-FY");
    expect(year.label).toBe("Full Year 2026");
    expect(year.start).toBe("2026-01-01");
    expect(year.end).toBe("2026-12-31");
  });

  it("parses period keys back", () => {
    expect(buildPeriod("MONTHLY", "2026-06").end).toBe("2026-06-30");
    expect(buildPeriod("QUARTERLY", "2026-Q2").start).toBe("2026-04-01");
    expect(buildPeriod("HALF_YEARLY", "2026-H2").start).toBe("2026-07-01");
    const ad = buildPeriod("AD_HOC", "2026-01-01_to_2026-06-30");
    expect(ad.end).toBe("2026-06-30");
    expect(buildPeriod("ANNUAL", "2026-FY").end).toBe("2026-12-31");
  });

  it("enumerates periods for a frequency", () => {
    expect(periodsForFrequency("MONTHLY", 2026)).toHaveLength(12);
    expect(periodsForFrequency("QUARTERLY", 2026)).toHaveLength(4);
    expect(periodsForFrequency("HALF_YEARLY", 2026)).toHaveLength(3);
    expect(periodsForFrequency("ANNUAL", 2026)).toHaveLength(1);
    expect(periodsForFrequency("AD_HOC", 2026)).toHaveLength(0);
  });
});

describe("income production builder", () => {
  it("returns one row per policy in the period, sorted by date", () => {
    const data: ReturnData = {
      policies: [
        makePolicy({ id: "b", policy_number: "P2", transaction_date: "2026-01-12" }),
        makePolicy({ id: "a", policy_number: "P1", transaction_date: "2026-01-05", gross_premium: 1000 }),
        makePolicy({ id: "c", policy_number: "P3", transaction_date: "2026-02-03" }),
      ],
      staff: [],
    };
    const rows = buildIncomeProductionRows(data.policies, monthlyPeriod(2026, 1));
    expect(rows).toHaveLength(2);
    expect(rows[0].policy_no).toBe("P1");
    expect(rows[1].policy_no).toBe("P2");
    expect(rows[0].sn).toBe(1);
    expect(rows[0].gross_premium).toBe(1000);
  });

  it("computes policy tenor in days", () => {
    const data: ReturnData = {
      policies: [
        makePolicy({
          policy_number: "P1",
          transaction_date: "2026-01-05",
          cover_from: "2026-01-05",
          cover_to: "2027-01-04",
        }),
      ],
      staff: [],
    };
    const rows = buildIncomeProductionRows(data.policies, monthlyPeriod(2026, 1));
    expect(rows[0].tenor).toBe(364);
  });
});

describe("CRR builder", () => {
  const period = quarterlyPeriod(2026, 1);

  it("derives net commission rate and net premium", () => {
    const rows = buildCrrRows(
      [
        makePolicy({
          transaction_date: "2026-01-17",
          gross_premium: 153000,
          commission_rate: 9,
          brokerage_commission: 13770,
          tax: 0,
          other_deductions: 0,
        }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].net_rate).toBe(9);
    expect(rows[0].net_premium).toBe(139230);
  });

  it("excludes policies outside the quarter", () => {
    const rows = buildCrrRows(
      [
        makePolicy({ transaction_date: "2025-12-30" }),
        makePolicy({ transaction_date: "2026-03-31" }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
  });
});

describe("businesses generated", () => {
  const period = halfYearlyPeriod(2026, "H1");

  it("splits NGN vs USD by policy currency", () => {
    const data: ReturnData = {
      policies: [
        makePolicy({
          policy_number: "N1",
          transaction_date: "2026-02-01",
          currency: "NGN",
          gross_premium: 1000,
          brokerage_commission: 100,
        }),
        makePolicy({
          policy_number: "U1",
          transaction_date: "2026-02-01",
          currency: "USD",
          gross_premium: 500,
          brokerage_commission: 50,
        }),
      ],
      staff: [],
    };
    const rows = buildBusinessesGeneratedRows(data.policies, period);
    expect(rows).toHaveLength(2);
    const ngn = rows.find((r) => r.gp_ngn !== null)!;
    const usd = rows.find((r) => r.gp_usd !== null)!;
    expect(ngn.gp_ngn).toBe(1000);
    expect(ngn.gp_usd).toBeNull();
    expect(usd.gp_ngn).toBeNull();
    expect(usd.gp_usd).toBe(500);
  });
});

describe("personnel builder", () => {
  const period = quarterlyPeriod(2026, 1);

  it("derives first + second schedules with correct counts", () => {
    const data: ReturnData = {
      policies: [],
      staff: [
        makeStaff({
          id: "s1",
          staff_name: "Ada",
          staff_category: "SENIOR MANAGEMENT",
          date_of_employment: "2010-01-04",
        }),
        makeStaff({
          id: "s2",
          staff_name: "Ben",
          staff_category: "SENIOR STAFF",
          date_of_employment: "2026-02-10",
        }),
        makeStaff({
          id: "s3",
          staff_name: "Cara",
          staff_category: "JUNIOR STAFF",
          date_of_employment: "2020-01-01",
          date_of_exit: "2026-02-15",
        }),
      ],
    };
    const rows = buildPersonnelRows(data.staff, period);
    const first = rows.filter((r) => r.schedule === "FIRST");
    const second = rows.filter((r) => r.schedule === "SECOND");

    expect(first).toHaveLength(3);

    const byCat = new Map(second.map((r) => [String(r.category), r]));
    expect(byCat.get("SENIOR MANAGEMENT")?.previous).toBe(1);
    expect(byCat.get("SENIOR MANAGEMENT")?.current).toBe(1);
    expect(byCat.get("SENIOR STAFF")?.entry).toBe(1);
    expect(byCat.get("JUNIOR STAFF")?.previous).toBe(1);
    expect(byCat.get("JUNIOR STAFF")?.exit).toBe(1);
    expect(byCat.get("JUNIOR STAFF")?.current).toBe(0);

    const total = byCat.get("TOTAL")!;
    expect(total.previous).toBe(2);
    expect(total.entry).toBe(1);
    expect(total.exit).toBe(1);
    expect(total.current).toBe(2);
  });
});

describe("form 1C builder", () => {
  it("groups by insurer and sums premiums", () => {
    const period = halfYearlyPeriod(2026, "H1");
    const rows = buildForm1CRows(
      [
        makePolicy({
          transaction_date: "2026-01-05",
          insurer_name: "AXA",
          gross_premium: 1000,
          premium_collected: 900,
          premium_paid_to_insurer: 700,
          brokerage_commission: 100,
        }),
        makePolicy({
          transaction_date: "2026-03-01",
          insurer_name: "AXA",
          gross_premium: 500,
          premium_collected: 500,
          premium_paid_to_insurer: 400,
          brokerage_commission: 50,
        }),
        makePolicy({
          transaction_date: "2026-02-01",
          insurer_name: "Leadway",
          gross_premium: 2000,
          premium_collected: 2000,
          premium_paid_to_insurer: 1800,
          brokerage_commission: 200,
        }),
      ],
      period
    );
    expect(rows).toHaveLength(2);
    const axa = rows.find((r) => r.insurer === "AXA")!;
    expect(axa.gross_premium).toBe(1500);
    expect(axa.policy_count).toBe(2);
    const totals = computeReturnTotals("FORM_1C", rows);
    expect(totals.find((t) => t.label === "Gross premium")?.value).toBe(3500);
  });
});

describe("brokerage commission register builder", () => {
  const period = annualPeriod(2026);

  it("derives net commission as commission earned minus withholding tax", () => {
    const rows = buildBrokerageCommissionRows(
      [
        makePolicy({
          transaction_date: "2026-05-11",
          client_name: "ADEWALE & CO",
          insurer_name: "AXA Mansard",
          policy_number: "WMK/2026/0042",
          class_of_business: "MARINE",
          sum_insured: 50_000_000,
          gross_premium: 750_000,
          commission_rate: 10,
          brokerage_commission: 75_000,
          tax: 7_500,
          premium_payment_date: "2026-06-01",
          receipt_number: "RCV/2026/88",
        }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].commission_earned).toBe(75_000);
    expect(rows[0].withholding_tax).toBe(7_500);
    expect(rows[0].net_commission).toBe(67_500);
    expect(rows[0].date_received).toBe("2026-06-01");
    expect(rows[0].receipt_no).toBe("RCV/2026/88");
  });

  it("covers the full year and totals commission columns", () => {
    const rows = buildBrokerageCommissionRows(
      [
        makePolicy({ transaction_date: "2026-01-05", gross_premium: 10_000, commission_rate: 10, brokerage_commission: 1_000, tax: 100 }),
        makePolicy({ transaction_date: "2026-12-20", gross_premium: 20_000, commission_rate: 10, brokerage_commission: 2_000, tax: 200 }),
        makePolicy({ transaction_date: "2025-12-30", gross_premium: 99_999, commission_rate: 10, brokerage_commission: 9_999 }),
      ],
      period
    );
    expect(rows).toHaveLength(2);
    const totals = computeReturnTotals("BROKERAGE_COMMISSION", rows);
    expect(totals.find((t) => t.label === "Commission earned")?.value).toBe(3_000);
    expect(totals.find((t) => t.label === "Net commission received")?.value).toBe(2_700);
  });
});

describe("computeReturnTotals", () => {
  it("sums income production money columns", () => {
    const period = monthlyPeriod(2026, 1);
    const rows = buildIncomeProductionRows(
      [
        makePolicy({
          transaction_date: "2026-01-05",
          sum_insured: 1000000,
          gross_premium: 10000,
          brokerage_commission: 1000,
          net_premium: 9000,
          amount_received: 10000,
        }),
        makePolicy({
          transaction_date: "2026-01-12",
          sum_insured: 2000000,
          gross_premium: 20000,
          brokerage_commission: 2000,
          net_premium: 18000,
          amount_received: 20000,
        }),
      ],
      period
    );
    const totals = computeReturnTotals("INCOME_PRODUCTION", rows);
    expect(totals.find((t) => t.label === "Gross premium")?.value).toBe(30000);
    expect(totals.find((t) => t.label === "Brokerage")?.value).toBe(3000);
  });
});

describe("adHocPeriod", () => {
  it("builds a custom range", () => {
    const p = adHocPeriod("2026-04-01", "2026-06-30");
    expect(p.key).toBe("2026-04-01_to_2026-06-30");
    expect(p.label).toBe("2026-04-01 to 2026-06-30");
  });
});
