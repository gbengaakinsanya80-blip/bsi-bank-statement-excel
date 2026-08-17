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
  buildClaimsAwaitingRows,
  buildForm1CRows,
  buildForm72BRows,
  buildForm72CRows,
  buildIncomeProductionRows,
  buildNewPoliciesRows,
  buildPersonnelRows,
  buildRenewalPoliciesRows,
} from "@/lib/returns/builders";
import { computeReturnTotals, RETURN_COLUMNS } from "@/lib/returns/columns";
import type { ClaimSource, PolicySource, ReturnData, StaffSource } from "@/lib/returns/types";

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
      claims: [],
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
      claims: [],
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
      claims: [],
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
      claims: [],
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

describe("new / renewal policies builders", () => {
  const period = monthlyPeriod(2026, 3);

  const newPolicy = makePolicy({
    policy_number: "WMK/2026/0101",
    transaction_type: "NEW",
    transaction_date: "2026-03-02",
    client_name: "Zenith Bank Plc",
    insured_name: "Zenith Bank Plc",
    insurer_name: "AXA Mansard Insurance Plc",
    class_of_business: "Fire",
    risk_type: "Fire",
    sum_insured: 1_000_000,
    gross_premium: 100_000,
    premium_collected: 100_000,
    premium_paid_to_insurer: 87_500,
    brokerage_commission: 12_500,
    tax: 1_250,
    net_premium: 88_750,
    cover_from: "2026-03-01",
    cover_to: "2027-02-28",
    premium_collection_date: "2026-03-02",
    premium_payment_date: "2026-03-05",
    receipt_number: "RCV/2026/101",
    bank_name: "GTBank",
    currency: "NGN",
    branch_location: "Lagos",
  });

  const renewalPolicy = makePolicy({
    policy_number: "WMK/2026/0102",
    transaction_type: "RENEWAL",
    transaction_date: "2026-03-11",
    client_name: "Dangote Cement Plc",
    insured_name: "Dangote Cement Plc",
    insurer_name: "Leadway Assurance Company Ltd",
    class_of_business: "Motor",
    risk_type: "Motor",
    sum_insured: 2_000_000,
    gross_premium: 200_000,
    premium_collected: 200_000,
    premium_paid_to_insurer: 175_000,
    brokerage_commission: 25_000,
    tax: 2_500,
    net_premium: 177_500,
    cover_from: "2026-04-01",
    cover_to: "2027-03-31",
    premium_collection_date: "2026-03-11",
    premium_payment_date: "2026-03-15",
    receipt_number: "RCV/2026/102",
    bank_name: "First Bank",
    currency: "NGN",
    branch_location: "Abuja",
  });

  it("keeps only NEW policies in the period for the new policies schedule", () => {
    const rows = buildNewPoliciesRows(
      [
        newPolicy,
        renewalPolicy,
        makePolicy({ transaction_type: "NEW", transaction_date: "2025-12-01", policy_number: "WMK/2025/0001" }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].policy_no).toBe("WMK/2026/0101");
  });

  it("keeps only RENEWAL policies in the period for the renewal policies schedule", () => {
    const rows = buildRenewalPoliciesRows(
      [
        newPolicy,
        renewalPolicy,
        makePolicy({ transaction_type: "RENEWAL", transaction_date: "2026-05-01", policy_number: "WMK/2026/0103" }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].policy_no).toBe("WMK/2026/0102");
  });

  it("derives premium due date from cover start and renewal due date from cover end", () => {
    const rows = buildNewPoliciesRows([newPolicy], period);
    expect(rows[0].premium_due_date).toBe("2026-03-01");
    expect(rows[0].renewal_due_date).toBe("2027-02-28");
    expect(rows[0].cover_from).toBe("2026-03-01");
    expect(rows[0].cover_to).toBe("2027-02-28");
  });

  it("falls back to transaction date when cover start is missing", () => {
    const rows = buildRenewalPoliciesRows(
      [makePolicy({ transaction_type: "RENEWAL", transaction_date: "2026-03-11", cover_from: null, cover_to: null })],
      period
    );
    expect(rows[0].premium_due_date).toBe("2026-03-11");
    expect(rows[0].renewal_due_date).toBeNull();
  });

  it("totals the premium and commission money columns", () => {
    const newRows = buildNewPoliciesRows([newPolicy], period);
    const totals = computeReturnTotals("NEW_POLICIES", newRows);
    expect(totals.find((t) => t.label === "Sum insured")?.value).toBe(1_000_000);
    expect(totals.find((t) => t.label === "Gross premium")?.value).toBe(100_000);
    expect(totals.find((t) => t.label === "Premium collected")?.value).toBe(100_000);
    expect(totals.find((t) => t.label === "Premium paid to insurer")?.value).toBe(87_500);
    expect(totals.find((t) => t.label === "Commission")?.value).toBe(12_500);
    expect(totals.find((t) => t.label === "Withholding tax")?.value).toBe(1_250);
    expect(totals.find((t) => t.label === "Net premium")?.value).toBe(88_750);
  });
});

describe("return column completeness", () => {
  const period = monthlyPeriod(2026, 3);
  const policy = makePolicy({
    policy_number: "WMK/2026/0101",
    transaction_type: "NEW",
    transaction_date: "2026-03-02",
    cover_from: "2026-03-01",
    cover_to: "2027-02-28",
    sum_insured: 1_000_000,
    gross_premium: 100_000,
  });
  const renewal = makePolicy({ ...policy, policy_number: "WMK/2026/0102", transaction_type: "RENEWAL" });

  it("new policies rows emit every defined column with no extras", () => {
    const rows = buildNewPoliciesRows([policy], period);
    const keys = RETURN_COLUMNS.NEW_POLICIES.map((c) => c.key);
    for (const k of keys) {
      expect(rows[0], `missing column ${k}`).toHaveProperty(k);
    }
    expect(Object.keys(rows[0]).sort()).toEqual(keys.sort());
  });

  it("renewal policies rows emit every defined column with no extras", () => {
    const rows = buildRenewalPoliciesRows([renewal], period);
    const keys = RETURN_COLUMNS.RENEWAL_POLICIES.map((c) => c.key);
    for (const k of keys) {
      expect(rows[0], `missing column ${k}`).toHaveProperty(k);
    }
    expect(Object.keys(rows[0]).sort()).toEqual(keys.sort());
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

describe("form 7.2B builder", () => {
  const period = halfYearlyPeriod(2026, "H1");

  it("splits premium by payment channel and currency", () => {
    const rows = buildForm72BRows(
      [
        makePolicy({
          policy_number: "WMK/2026/001",
          insured_name: "ADEWALE & CO",
          insurer_name: "AXA Mansard",
          transaction_date: "2026-01-13",
          cover_from: "2026-01-12",
          cover_to: "2027-01-11",
          sum_insured: 1_000_000,
          currency: "NGN",
          gross_premium: 153_000,
          premium_collected: 153_000,
          brokerage_commission: 13_770,
          amount_received: 153_000,
          premium_collection_date: "2026-01-12",
        }),
        makePolicy({
          policy_number: "WMK/2026/002",
          insured_name: "NNPCL",
          insurer_name: "VARIOUS",
          transaction_date: "2026-02-02",
          cover_from: "2026-02-01",
          cover_to: "2027-01-31",
          currency: "USD",
          gross_premium: 50_000,
          premium_collected: 50_000,
          brokerage_commission: 5_000,
        }),
        makePolicy({
          policy_number: "WMK/2026/003",
          insured_name: "LAGOS STATE",
          insurer_name: "LASACO",
          transaction_date: "2026-03-05",
          cover_from: "2026-03-05",
          cover_to: "2027-03-04",
          currency: "NGN",
          gross_premium: 10_000,
          premium_collected: 6_000,
          brokerage_commission: 1_000,
        }),
      ],
      period
    );
    expect(rows).toHaveLength(3);

    const ngn = rows[0];
    expect(ngn.month).toBe("2026-01");
    expect(ngn.name_of_insured).toBe("ADEWALE & CO");
    expect(ngn.insurer).toBe("AXA Mansard");
    expect(ngn.sd).toBe("2026-01-12");
    expect(ngn.ed).toBe("2027-01-11");
    expect(ngn.premium_paid_directly).toBe(0);
    expect(ngn.premium_paid_to_brokers_local).toBe(153_000);
    expect(ngn.premium_paid_to_brokers_foreign).toBe(0);
    expect(ngn.total_gross_premium).toBe(153_000);
    expect(ngn.net_premium).toBe(139_230);
    expect(ngn.premium_received_by_broker).toBe(153_000);
    expect(ngn.total_commission_fee).toBe(13_770);
    expect(ngn.commission_due_to_cobrokers).toBe(0);
    expect(ngn.commission_due_to_reporting).toBe(13_770);
    // Time-based apportionment: 169 days elapsed (Jan 12 → Jun 30) / 364 cover days
    expect(ngn.commission_income_earned).toBe(6393.21);
    expect(ngn.deferred_commission).toBe(7376.79);

    const usd = rows[1];
    expect(usd.premium_paid_directly).toBe(0);
    expect(usd.premium_paid_to_brokers_local).toBe(0);
    expect(usd.premium_paid_to_brokers_foreign).toBe(50_000);
    expect(usd.total_gross_premium).toBe(50_000);
    // Time-based: 149 days elapsed (Feb 1 → Jun 30) / 364 cover days
    expect(usd.commission_income_earned).toBe(2046.70);
    expect(usd.deferred_commission).toBe(2953.30);

    const partial = rows[2];
    expect(partial.premium_paid_directly).toBe(4_000);
    expect(partial.premium_paid_to_brokers_local).toBe(6_000);
    expect(partial.total_gross_premium).toBe(10_000);
    // Time-based: 117 days elapsed (Mar 5 → Jun 30) / 364 cover days
    expect(Number(partial.commission_income_earned)).toBe(321.43);
    expect(Number(partial.deferred_commission)).toBe(678.57);
    expect(Number(partial.commission_income_earned) + Number(partial.deferred_commission)).toBe(1_000);
  });

  it("excludes policies outside the half-year", () => {
    const rows = buildForm72BRows(
      [
        makePolicy({ transaction_date: "2025-12-01" }),
        makePolicy({ transaction_date: "2026-06-30" }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
  });

  it("emits every defined column with no extras", () => {
    const rows = buildForm72BRows(
      [
        makePolicy({
          policy_number: "WMK/2026/001",
          transaction_date: "2026-01-05",
          gross_premium: 1000,
          premium_collected: 1000,
        }),
      ],
      period
    );
    const keys = RETURN_COLUMNS.FORM_7_2B.map((c) => c.key);
    for (const k of keys) {
      expect(rows[0], `missing column ${k}`).toHaveProperty(k);
    }
    expect(Object.keys(rows[0]).sort()).toEqual(keys.sort());
  });

  it("totals the money columns", () => {
    const rows = buildForm72BRows(
      [
        makePolicy({
          transaction_date: "2026-01-05",
          cover_from: "2026-01-01",
          cover_to: "2026-12-31",
          gross_premium: 100_000,
          premium_collected: 100_000,
          brokerage_commission: 10_000,
        }),
        makePolicy({
          transaction_date: "2026-03-02",
          cover_from: "2026-03-01",
          cover_to: "2027-02-28",
          gross_premium: 50_000,
          premium_collected: 50_000,
          brokerage_commission: 5_000,
        }),
      ],
      period
    );
    const totals = computeReturnTotals("FORM_7_2B", rows);
    expect(totals.find((t) => t.label === "Total gross premium (d)")?.value).toBe(150_000);
    // Policy 1: 180/364 × 10000 = 4945.05, Policy 2: 121/364 × 5000 = 1662.09
    expect(totals.find((t) => t.label === "Commission income earned")?.value).toBe(6607.14);
    expect(totals.find((t) => t.label === "Deferred commission income")?.value).toBe(8392.86);
  });
});

describe("form 7.2C builder", () => {
  const period = halfYearlyPeriod(2026, "H1");

  it("derives due, remitted and outstanding amounts", () => {
    const rows = buildForm72CRows(
      [
        makePolicy({
          policy_number: "WMK/2026/001",
          insured_name: "ADEWALE & CO",
          insurer_name: "EMPLE",
          transaction_date: "2026-01-20",
          cover_from: "2026-01-19",
          cover_to: "2027-01-18",
          currency: "NGN",
          gross_premium: 100_000,
          premium_collected: 100_000,
          premium_paid_to_insurer: 90_000,
          brokerage_commission: 10_000,
          bank_name: "Fidelity",
          premium_payment_date: "2026-01-25",
        }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.month).toBe("2026-01");
    expect(r.name_of_insured).toBe("ADEWALE & CO");
    expect(r.sd).toBe("2026-01-19");
    expect(r.total_received).toBe(100_000);
    expect(r.premium_due_to_insurers).toBe(90_000);
    expect(r.deposit_by_insured).toBe(0);
    expect(r.returned_premium_due).toBe(0);
    expect(r.claims_due).toBe(0);
    expect(r.vat_due).toBe(0);
    expect(r.commission_due_cobrokers).toBe(0);
    expect(r.commission_due_reporting).toBe(10_000);
    expect(r.date_remitted).toBe("2026-01-25");
    expect(r.paying_bank).toBe("Fidelity");
    expect(r.premium_remitted).toBe(90_000);
    expect(r.claims_remitted).toBe(0);
    expect(r.vat_remitted).toBe(0);
    expect(r.commission_remitted).toBe(9_000);
    expect(r.outstanding_premium).toBe(0);
    expect(r.outstanding_claims).toBe(0);
    expect(r.outstanding_vat).toBe(0);
    expect(r.outstanding_commission).toBe(1_000);
  });

  it("flags outstanding premium when remittance is short", () => {
    const rows = buildForm72CRows(
      [
        makePolicy({
          transaction_date: "2026-02-11",
          gross_premium: 100_000,
          premium_collected: 50_000,
          premium_paid_to_insurer: 20_000,
          brokerage_commission: 10_000,
        }),
      ],
      period
    );
    const r = rows[0];
    expect(r.premium_due_to_insurers).toBe(40_000);
    expect(r.outstanding_premium).toBe(20_000);
    expect(r.commission_remitted).toBe(4_000);
    expect(r.outstanding_commission).toBe(6_000);
  });

  it("excludes policies outside the half-year", () => {
    const rows = buildForm72CRows(
      [
        makePolicy({ transaction_date: "2025-12-01" }),
        makePolicy({ transaction_date: "2026-06-30" }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
  });

  it("emits every defined column with no extras", () => {
    const rows = buildForm72CRows(
      [
        makePolicy({
          policy_number: "WMK/2026/001",
          transaction_date: "2026-01-05",
          gross_premium: 1000,
          premium_collected: 1000,
          premium_paid_to_insurer: 900,
          brokerage_commission: 100,
        }),
      ],
      period
    );
    const keys = RETURN_COLUMNS.FORM_7_2C.map((c) => c.key);
    for (const k of keys) {
      expect(rows[0], `missing column ${k}`).toHaveProperty(k);
    }
    expect(Object.keys(rows[0]).sort()).toEqual(keys.sort());
  });

  it("totals the money columns", () => {
    const rows = buildForm72CRows(
      [
        makePolicy({ transaction_date: "2026-01-05", gross_premium: 100_000, premium_collected: 100_000, premium_paid_to_insurer: 90_000, brokerage_commission: 10_000 }),
        makePolicy({ transaction_date: "2026-03-02", gross_premium: 50_000, premium_collected: 50_000, premium_paid_to_insurer: 45_000, brokerage_commission: 5_000 }),
      ],
      period
    );
    const totals = computeReturnTotals("FORM_7_2C", rows);
    expect(totals.find((t) => t.label === "Total premium received by brokers")?.value).toBe(150_000);
    expect(totals.find((t) => t.label === "Premium due to insurers")?.value).toBe(135_000);
    expect(totals.find((t) => t.label === "Premium remitted to insurers")?.value).toBe(135_000);
    expect(totals.find((t) => t.label === "Commission remitted")?.value).toBe(13_500);
    expect(totals.find((t) => t.label === "Outstanding commission due")?.value).toBe(1_500);
  });
});

describe("claims awaiting payment builder", () => {
  const period = quarterlyPeriod(2026, 2);

  function makeClaim(overrides: Partial<ClaimSource>): ClaimSource {
    return {
      id: "c-1",
      date_notified_by_insured: null,
      date_notified_to_insurer: null,
      insurer_name: null,
      claim_no: null,
      claim_amount: null,
      date_discharge_voucher: null,
      insured_beneficiary: null,
      date_payment: null,
      remarks: null,
      ...overrides,
    };
  }

  it("includes claims notified in the current quarter", () => {
    const rows = buildClaimsAwaitingRows(
      [makeClaim({ id: "c1", date_notified_to_insurer: "2026-05-10", claim_amount: 500_000 })],
      period
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].claim_amount).toBe(500_000);
  });

  it("rolls over unsettled claims from prior quarters", () => {
    const rows = buildClaimsAwaitingRows(
      [
        makeClaim({ id: "c1", date_notified_to_insurer: "2026-01-15", claim_amount: 200_000 }),
        makeClaim({ id: "c2", date_notified_to_insurer: "2026-04-20", claim_amount: 300_000 }),
      ],
      period
    );
    expect(rows).toHaveLength(2);
  });

  it("excludes settled claims from prior quarters", () => {
    const rows = buildClaimsAwaitingRows(
      [
        makeClaim({ id: "c1", date_notified_to_insurer: "2026-01-15", claim_amount: 200_000, date_payment: "2026-03-20" }),
        makeClaim({ id: "c2", date_notified_to_insurer: "2026-04-20", claim_amount: 300_000 }),
      ],
      period
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].claim_amount).toBe(300_000);
  });

  it("excludes claims notified after the period end", () => {
    const rows = buildClaimsAwaitingRows(
      [makeClaim({ id: "c1", date_notified_to_insurer: "2026-07-15", claim_amount: 100_000 })],
      period
    );
    expect(rows).toHaveLength(0);
  });

  it("excludes claims with no notification date", () => {
    const rows = buildClaimsAwaitingRows(
      [makeClaim({ id: "c1", date_notified_to_insurer: null, claim_amount: 100_000 })],
      period
    );
    expect(rows).toHaveLength(0);
  });
});
