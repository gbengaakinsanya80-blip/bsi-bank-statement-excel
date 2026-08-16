import { describe, expect, it } from "vitest";
import { autoMapColumn, autoMapColumns, detectCurrency, detectHeaderRow } from "@/lib/import/mapping";
import {
  parseAmount,
  parseDateValue,
  validateSheet,
  type ImportValidationSummary,
} from "@/lib/import/validation";
import type { XlsxCell } from "@/lib/import/xlsx-reader";

describe("column auto-mapping", () => {
  it("maps common NAICOM headers to policy fields", () => {
    expect(autoMapColumn("POLICY NO")).toBe("policy_number");
    expect(autoMapColumn("NAME OF CLIENT")).toBe("client_name");
    expect(autoMapColumn("NAME OF INSURER")).toBe("insurer_name");
    expect(autoMapColumn("GROSS PREMIUM (₦)")).toBe("gross_premium");
    expect(autoMapColumn("WITHHOLDING TAX")).toBe("tax");
    expect(autoMapColumn("BROKERAGE COMMISSION")).toBe("brokerage_commission");
    expect(autoMapColumn("DATE OF RECEIPT")).toBe("premium_collection_date");
    expect(autoMapColumn("TOTALS")).toBeNull();
  });

  it("detects currency from headers", () => {
    expect(detectCurrency("GROSS PREMIUM ($)")).toBe("USD");
    expect(detectCurrency("GROSS PREMIUM USD")).toBe("USD");
    expect(detectCurrency("GROSS PREMIUM (₦)")).toBe("NGN");
  });

  it("auto-maps a full header row", () => {
    const cols = autoMapColumns(["S/NO", "POLICY NO", "NAME OF CLIENT", "SUM INSURED", "GROSS PREMIUM"]);
    expect(cols.map((c) => c.targetKey)).toEqual([
      "transaction_reference",
      "policy_number",
      "client_name",
      "sum_insured",
      "gross_premium",
    ]);
  });

  it("skips title blocks when locating the header row", () => {
    const rows = [
      ["COMMISSION AND REBATE RETURNS (CRR)"],
      [],
      ["POLICY NO", "NAME OF CLIENT", "GROSS PREMIUM"],
      ["WMK/1", "A", 1000],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
    expect(detectHeaderRow([["POLICY NO", "GROSS PREMIUM"], ["WMK/1", 1000]])).toBe(0);
  });
});

describe("value normalization", () => {
  it("parses naira/dollar amounts and sentinels", () => {
    expect(parseAmount("₦1,250,000").value).toBe(1250000);
    expect(parseAmount("1,250,000.50").value).toBe(1250000.5);
    expect(parseAmount("USD 162944.5997").value).toBe(162944.5997);
    expect(parseAmount("NIL").value).toBeNull();
    expect(parseAmount("-").value).toBeNull();
    expect(parseAmount("1,2..5").ok).toBe(false);
    expect(parseAmount("-500").ok).toBe(false);
    expect(parseAmount(null).value).toBeNull();
  });

  it("parses common date formats to ISO", () => {
    expect(parseDateValue("05/01/2026").value).toBe("2026-01-05");
    expect(parseDateValue("2026-11-02").value).toBe("2026-11-02");
    expect(parseDateValue("2026/03/31").value).toBe("2026-03-31");
    expect(parseDateValue("35/06/2026").ok).toBe(false);
    expect(parseDateValue("5 January 2026").value).toBe("2026-01-05");
    expect(parseDateValue("Jan 5, 2026").value).toBe("2026-01-05");
    expect(parseDateValue("N/A").value).toBeNull();
  });
});

const HEADER: string[] = ["POLICY NO", "NAME OF CLIENT", "GROSS PREMIUM", "BROKERAGE COMMISSION", "DATE"];
const mapping = autoMapColumns(HEADER);

function run(rows: XlsxCell[][]): ImportValidationSummary {
  return validateSheet(rows, mapping);
}

describe("validateSheet", () => {
  it("validates clean rows", () => {
    const summary = run([
      ["WMK/1", "Zenith Bank Plc", 1000, 100, "2026-01-05"],
      ["WMK/2", "Dangote", "₦2,000", "200", "05/01/2026"],
    ]);
    expect(summary.total).toBe(2);
    expect(summary.valid).toBe(2);
    expect(summary.invalid).toBe(0);
    expect(summary.results[1].record?.gross_premium).toBe(2000);
    expect(summary.results[1].record?.transaction_date).toBe("2026-01-05");
  });

  it("rejects rows with bad amounts or dates", () => {
    const summary = run([
      ["WMK/1", "A", "1,2..5", null, "2026-01-05"],
      ["WMK/2", "B", 1000, 100, "35/06/2026"],
    ]);
    expect(summary.valid).toBe(0);
    expect(summary.invalid).toBe(2);
    expect(summary.results[0].issues[0]).toContain("not a valid amount");
    expect(summary.results[1].issues[0]).toContain("impossible date");
  });

  it("requires a policy number", () => {
    const summary = run([["", "Zenith Bank Plc", 1000, 100, "2026-01-05"]]);
    expect(summary.results[0].valid).toBe(false);
    expect(summary.results[0].issues[0]).toContain("policy number is required");
  });

  it("flags duplicates and skips blank rows", () => {
    const summary = run([
      ["WMK/1", "A", 1000, 100, "2026-01-05"],
      ["WMK/1", "A", 1000, 100, "2026-01-05"],
      [null, null, null, null, null],
    ]);
    expect(summary.total).toBe(2);
    expect(summary.valid).toBe(1);
    expect(summary.duplicates).toBe(1);
  });
});
