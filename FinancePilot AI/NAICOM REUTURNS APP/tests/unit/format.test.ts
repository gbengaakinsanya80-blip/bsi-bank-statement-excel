import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, titleCase } from "@/lib/utils/format";

describe("formatMoney", () => {
  it("formats NGN amounts with the naira sign", () => {
    expect(formatMoney(1250.5)).toBe("₦1,250.50");
  });

  it("formats USD with the dollar sign", () => {
    expect(formatMoney("162944.5997", "USD")).toBe("$162,944.60");
  });

  it("returns an em dash for null/undefined/empty", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
    expect(formatMoney("")).toBe("—");
  });

  it("returns an em dash for non-numeric strings", () => {
    expect(formatMoney("USD 162944.5997")).toBe("—");
  });
});

describe("formatDate", () => {
  it("formats ISO dates", () => {
    expect(formatDate("2026-06-30")).toContain("2026");
  });

  it("returns em dash for empty", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("titleCase", () => {
  it("converts snake_case to title case", () => {
    expect(titleCase("READY_FOR_REVIEW")).toBe("Ready For Review");
    expect(titleCase("NEW")).toBe("New");
  });

  it("handles empty input", () => {
    expect(titleCase(null)).toBe("—");
  });
});
