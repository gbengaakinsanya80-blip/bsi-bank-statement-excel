import { describe, expect, it } from "vitest";
import {
  applyReportFilters,
  groupBy,
  monthlyTrend,
  reportTotals,
  type ReportRow,
} from "@/lib/services/reporting-service";

function makeRow(p: Partial<ReportRow>): ReportRow {
  return {
    id: "p-1",
    policy_number: "WMK/2026/0001",
    insured_name: "ADEWALE & CO",
    client_name: "Zenith Bank Plc",
    insurer_name: "AXA Mansard Insurance Plc",
    risk_type: "Fire",
    class_of_business: "Fire",
    currency: "NGN",
    transaction_date: "2026-01-15",
    gross_premium: 1_000_000,
    premium_collected: 900_000,
    premium_paid_to_insurer: 800_000,
    brokerage_commission: 100_000,
    ...p,
  };
}

describe("reporting-service", () => {
  describe("reportTotals", () => {
    it("sums money fields and computes outstanding (clamped at zero)", () => {
      const rows = [
        makeRow({ gross_premium: 1_000_000, premium_collected: 900_000, premium_paid_to_insurer: 800_000, brokerage_commission: 100_000 }),
        makeRow({ gross_premium: 500_000, premium_collected: 400_000, premium_paid_to_insurer: 450_000, brokerage_commission: 50_000 }),
      ];
      const totals = reportTotals(rows);
      expect(totals.count).toBe(2);
      expect(totals.gross_premium).toBe(1_500_000);
      expect(totals.premium_collected).toBe(1_300_000);
      expect(totals.premium_paid_to_insurer).toBe(1_250_000);
      expect(totals.outstanding).toBe(50_000);
      expect(totals.brokerage_commission).toBe(150_000);
    });
  });

  describe("monthlyTrend", () => {
    it("groups rows by YYYY-MM and sorts chronologically", () => {
      const rows = [
        makeRow({ transaction_date: "2026-03-10", gross_premium: 300 }),
        makeRow({ transaction_date: "2026-01-05", gross_premium: 100 }),
        makeRow({ transaction_date: "2026-02-01", gross_premium: 200 }),
        makeRow({ transaction_date: "2026-01-20", gross_premium: 50 }),
      ];
      const trend = monthlyTrend(rows);
      expect(trend.map((t) => t.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
      expect(trend[0].gross_premium).toBe(150);
      expect(trend[0].count).toBe(2);
      expect(trend[2].count).toBe(1);
    });

    it("skips rows without a transaction date", () => {
      const trend = monthlyTrend([makeRow({ transaction_date: null })]);
      expect(trend).toHaveLength(0);
    });
  });

  describe("groupBy", () => {
    it("groups by the requested key, ordered by gross premium descending", () => {
      const rows = [
        makeRow({ insurer_name: "Leadway", gross_premium: 100 }),
        makeRow({ insurer_name: "AXA", gross_premium: 400 }),
        makeRow({ insurer_name: "AXA", gross_premium: 100 }),
      ];
      const byInsurer = groupBy(rows, "insurer_name");
      expect(byInsurer.map((g) => g.name)).toEqual(["AXA", "Leadway"]);
      expect(byInsurer[0].count).toBe(2);
      expect(byInsurer[0].gross_premium).toBe(500);
      expect(byInsurer[1].count).toBe(1);
    });

    it("falls back to class_of_business when risk_type is missing and labels unknowns", () => {
      const rows = [
        makeRow({ risk_type: null, class_of_business: "Motor", gross_premium: 10 }),
        makeRow({ risk_type: null, class_of_business: null, gross_premium: 5 }),
      ];
      const byClass = groupBy(rows, "risk_type");
      expect(byClass.map((g) => g.name)).toEqual(["Motor", "Unclassified"]);
    });
  });

  describe("applyReportFilters", () => {
    it("filters by date range, client, insurer, risk and currency", () => {
      const rows = [
        makeRow({ transaction_date: "2026-01-15", client_name: "Zenith", insurer_name: "AXA", risk_type: "Fire", currency: "NGN" }),
        makeRow({ transaction_date: "2026-03-15", client_name: "MTN", insurer_name: "Leadway", risk_type: "Motor", currency: "NGN" }),
        makeRow({ transaction_date: "2026-02-10", client_name: "Zenith", insurer_name: "AIICO", risk_type: "Fire", currency: "USD" }),
      ];
      const filtered = applyReportFilters(rows, {
        from: "2026-02-01",
        to: "2026-02-28",
        client: "zenith",
        risk: "fire",
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].currency).toBe("USD");

      expect(applyReportFilters(rows, { currency: "NGN" })).toHaveLength(2);
      expect(applyReportFilters(rows, { insurer: "leadway" })).toHaveLength(1);
    });

    it("excludes rows without a transaction date when a range is set", () => {
      const rows = [makeRow({ transaction_date: null }), makeRow({ transaction_date: "2026-05-01" })];
      expect(applyReportFilters(rows, { from: "2026-01-01" })).toHaveLength(1);
    });
  });
});
