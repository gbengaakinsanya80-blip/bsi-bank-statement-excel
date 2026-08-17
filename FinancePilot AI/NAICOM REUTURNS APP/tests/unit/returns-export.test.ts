import { describe, expect, it } from "vitest";
import {
  buildReturnSheets,
  buildReturnWorkbook,
  buildXlsx,
} from "@/lib/returns/excel";
import { EXPORT_FORMATS, getExportFormat } from "@/lib/returns/export-format";
import { canTransition, nextStatuses, statusVariant } from "@/lib/returns/status";
import type { ReturnRow } from "@/lib/returns/types";

describe("export formats", () => {
  it("defines an export format for every return code", () => {
    const codes = [
      "INCOME_PRODUCTION",
      "PPS",
      "CRR",
      "BUSINESSES_GENERATED",
      "PERSONNEL",
      "FORM_1C",
      "BROKERAGE_COMMISSION",
      "NEW_POLICIES",
      "RENEWAL_POLICIES",
      "FORM_7_2B",
      "FORM_7_2C",
      "CLAIMS_AWAITING",
      "BIZ_SCHEDULE",
    ];
    for (const code of codes) {
      expect(EXPORT_FORMATS[code]).toBeDefined();
      expect(getExportFormat(code).title.length).toBeGreaterThan(0);
    }
  });

  it("falls back to the code for unknown formats", () => {
    expect(getExportFormat("UNKNOWN").title).toBe("UNKNOWN");
  });
});

describe("xlsx builder", () => {
  it("produces a valid zip container with the OOXML parts", () => {
    const sheets = [
      { name: "CRR", rows: [["COMMISSION AND REBATE RETURNS"], ["A", 1, null]] },
    ];
    const buf = buildXlsx(sheets);
    expect(buf.subarray(0, 2).toString("latin1")).toBe("PK");
    const names = buf.toString("latin1");
    expect(names).toContain("[Content_Types].xml");
    expect(names).toContain("xl/workbook.xml");
    expect(names).toContain("xl/worksheets/sheet1.xml");
  });
});

describe("return workbook", () => {
  const rows: ReturnRow[] = [
    {
      sn: 1,
      date: "2026-01-17",
      policy_no: "WMK/2026/0001",
      client: "ADEWALE & CO",
      insurer: "AXA",
      sum_insured: 1000000,
      gross_premium: 10000,
      approved_rate: 9,
      tax_paid: 0,
      net_rate: 9,
      brokerage_commission: 900,
      other_deduction: 0,
      net_premium: 9100,
      amount_received: 10000,
    },
  ];

  it("builds a single-sheet workbook with title, headers and totals", () => {
    const sheets = buildReturnSheets({
      code: "CRR",
      rows,
      totals: [{ label: "Gross premium", value: 10000 }],
      periodLabel: "Q1 2026",
    });
    expect(sheets).toHaveLength(1);
    expect(sheets[0].name).toBe("CRR");
    expect(sheets[0].rows[0][0]).toBe("COMMISSION AND REBATE RETURNS (CRR)");
    expect(sheets[0].rows[3]).toContain("Name of Client");
    expect(sheets[0].rows[6]).toEqual(["Gross premium", 10000]);
  });

  it("builds two sheets for personnel", () => {
    const personnel: ReturnRow[] = [
      { schedule: "FIRST", staff_name: "Ada", staff_category: "SENIOR" },
      { schedule: "SECOND", category: "SENIOR", previous: 1, entry: 1, exit: 0, current: 2 },
    ];
    const sheets = buildReturnSheets({
      code: "PERSONNEL",
      rows: personnel,
      totals: [],
      periodLabel: "Q1 2026",
    });
    expect(sheets).toHaveLength(2);
    expect(sheets[0].name).toBe("FIRST SCHEDULE");
    expect(sheets[1].name).toBe("SECOND SCHEDULE");
  });

  it("builds a form 7.2B workbook with its own title and headers", () => {
    const sheets = buildReturnSheets({
      code: "FORM_7_2B",
      rows: [
        { month: "2026-01", sn: 1, name_of_insured: "ADEWALE & CO", insurer: "EMPLE", total_gross_premium: 153000, net_premium: 139230, premium_received_by_broker: 153000, total_commission_fee: 13770, commission_income_earned: 13770, deferred_commission: 0 },
      ],
      totals: [{ label: "Total gross premium (d)", value: 153000 }],
      periodLabel: "H1 2026",
    });
    expect(sheets).toHaveLength(1);
    expect(sheets[0].rows[0][0]).toContain("FORM 7.2B");
    expect(sheets[0].rows[3]).toContain("NAME OF INSURED/POLICY NO.");
    const result = buildReturnWorkbook({
      code: "FORM_7_2B",
      rows: [],
      totals: [],
      periodLabel: "H1 2026",
    });
    expect(result.filename).toBe("FORM_7_2B-H1-2026.xlsx");
    expect(result.buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });

  it("returns a buffer and a safe filename", () => {
    const result = buildReturnWorkbook({
      code: "CRR",
      rows,
      totals: [],
      periodLabel: "Q1 2026",
    });
    expect(result.filename).toBe("CRR-Q1-2026.xlsx");
    expect(result.buffer.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});

describe("return status transitions", () => {
  it("walks the full review workflow forward", () => {
    expect(canTransition("DRAFT", "IN_PROGRESS")).toBe(true);
    expect(canTransition("DRAFT", "READY_FOR_REVIEW")).toBe(true);
    expect(canTransition("IN_PROGRESS", "READY_FOR_REVIEW")).toBe(true);
    expect(canTransition("READY_FOR_REVIEW", "REVIEWED")).toBe(true);
    expect(canTransition("REVIEWED", "APPROVED")).toBe(true);
    expect(canTransition("APPROVED", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "CLOSED")).toBe(true);
  });

  it("allows returning to draft along the workflow", () => {
    expect(canTransition("READY_FOR_REVIEW", "DRAFT")).toBe(true);
    expect(canTransition("REVIEWED", "READY_FOR_REVIEW")).toBe(true);
    expect(canTransition("APPROVED", "DRAFT")).toBe(true);
    expect(canTransition("CLOSED", "DRAFT")).toBe(false);
    expect(canTransition("DRAFT", "APPROVED")).toBe(false);
  });

  it("enumerates the next actions", () => {
    expect(nextStatuses("DRAFT")).toEqual(["IN_PROGRESS", "READY_FOR_REVIEW"]);
    expect(nextStatuses("CLOSED")).toEqual([]);
  });

  it("maps statuses to badge variants", () => {
    expect(statusVariant("DRAFT")).toBe("secondary");
    expect(statusVariant("READY_FOR_REVIEW")).toBe("warning");
    expect(statusVariant("APPROVED")).toBe("success");
    expect(statusVariant("CLOSED")).toBe("success");
    expect(statusVariant("OVERDUE")).toBe("destructive");
  });
});
