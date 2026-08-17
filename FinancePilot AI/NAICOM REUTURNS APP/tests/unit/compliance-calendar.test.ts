import { describe, expect, it } from "vitest";
import {
  buildCalendarYear,
  colorForCalendarItem,
  computeDueDate,
  daysUntil,
  statusForCalendarItem,
} from "@/lib/compliance/calendar";
import { deriveDemoNotifications } from "@/lib/compliance/notifications";
import { monthlyPeriod, quarterlyPeriod, halfYearlyPeriod } from "@/lib/returns/periods";

const TODAY = new Date("2026-08-14T12:00:00Z");

describe("computeDueDate", () => {
  it("computes monthly due dates with end-of-month clamping", () => {
    expect(
      computeDueDate({ frequency: "MONTHLY", day_of_month: 15, confirmed: true }, monthlyPeriod(2026, 1))
    ).toBe("2026-01-15");
    expect(
      computeDueDate({ frequency: "MONTHLY", day_of_month: 31, confirmed: true }, monthlyPeriod(2026, 2))
    ).toBe("2026-02-28");
    expect(
      computeDueDate({ frequency: "MONTHLY", day_of_month: 29, confirmed: true }, monthlyPeriod(2024, 2))
    ).toBe("2024-02-29");
  });

  it("computes quarterly and half-yearly offsets from period end", () => {
    expect(
      computeDueDate({ frequency: "QUARTERLY", days_after_period_end: 21, confirmed: true }, quarterlyPeriod(2026, 1))
    ).toBe("2026-04-21");
    expect(
      computeDueDate({ frequency: "HALF_YEARLY", days_after_period_end: 30, confirmed: true }, halfYearlyPeriod(2026, "H1"))
    ).toBe("2026-07-30");
  });

  it("computes annual due dates in the year after the reporting year", () => {
    expect(
      computeDueDate(
        { frequency: "ANNUAL", due_month: 1, due_day: 31, confirmed: true },
        { start: "2026-01-01", end: "2026-12-31" }
      )
    ).toBe("2027-01-31");
  });

  it("uses fixed dates for ad-hoc returns", () => {
    expect(
      computeDueDate(
        { frequency: "AD_HOC", fixed_date: "2026-03-31", confirmed: true },
        { start: "2026-01-01", end: "2026-06-30" }
      )
    ).toBe("2026-03-31");
  });

  it("returns null when a deadline is unconfirmed", () => {
    expect(computeDueDate({ frequency: "MONTHLY", day_of_month: 15, confirmed: false }, monthlyPeriod(2026, 1))).toBeNull();
    expect(computeDueDate(undefined, monthlyPeriod(2026, 1))).toBeNull();
  });
});

describe("calendar colour coding", () => {
  it("counts days remaining", () => {
    expect(daysUntil("2026-08-15", TODAY)).toBe(1);
    expect(daysUntil("2026-08-10", TODAY)).toBe(-4);
    expect(daysUntil("2026-08-14", TODAY)).toBe(0);
  });

  it("maps overdue / due-soon / completed / unconfirmed buckets", () => {
    expect(colorForCalendarItem("NOT_STARTED", "2026-08-10", TODAY).color).toBe("RED");
    expect(colorForCalendarItem("IN_PROGRESS", "2026-08-15", TODAY).color).toBe("ORANGE");
    expect(colorForCalendarItem("NOT_STARTED", "2026-08-24", TODAY).color).toBe("YELLOW");
    expect(colorForCalendarItem("NOT_STARTED", "2026-10-01", TODAY).color).toBe("GREY");
    expect(colorForCalendarItem("APPROVED", "2026-08-10", TODAY).color).toBe("GREEN");
    expect(colorForCalendarItem("NOT_STARTED", null, TODAY).color).toBe("GREY");
    expect(colorForCalendarItem("NOT_STARTED", null, TODAY).colorLabel).toContain("confirmation");
  });

  it("flags overdue status for un-started items past due", () => {
    expect(statusForCalendarItem("NOT_STARTED", "2026-08-10", TODAY)).toBe("OVERDUE");
    expect(statusForCalendarItem("IN_PROGRESS", "2026-08-10", TODAY)).toBe("IN_PROGRESS");
    expect(statusForCalendarItem("APPROVED", "2026-08-10", TODAY)).toBe("APPROVED");
  });
});

describe("buildCalendarYear", () => {
  it("enumerates every return × period for the year", () => {
    const items = buildCalendarYear(2026, {}, TODAY);
    expect(items.length).toBe(75);
    const crrQ1 = items.find((i) => i.code === "CRR" && i.periodKey === "2026-Q1");
    expect(crrQ1?.dueDate).toBe("2026-04-21");
    expect(crrQ1?.color).toBe("RED");
    expect(items.find((i) => i.code === "FORM_1C")?.requiresConfirmation).toBe(true);
    expect(items.filter((i) => i.code === "FORM_7_2B").length).toBe(3);
    expect(items.filter((i) => i.code === "FORM_7_2C").length).toBe(3);
    expect(items.filter((i) => i.code === "CLAIMS_AWAITING").length).toBe(4);
    expect(items.filter((i) => i.code === "BIZ_SCHEDULE").length).toBe(4);
  });

  it("lists the annual brokerage commission register due next January", () => {
    const items = buildCalendarYear(2026, {}, TODAY);
    const register = items.find((i) => i.code === "BROKERAGE_COMMISSION");
    expect(register).toBeDefined();
    expect(register?.frequency).toBe("ANNUAL");
    expect(register?.periodKey).toBe("2026-FY");
    expect(register?.dueDate).toBe("2027-01-31");
    expect(register?.requiresConfirmation).toBe(false);
    expect(register?.color).toBe("GREY");
  });

  it("links existing returns and preserves their status", () => {
    const existing = {
      "CRR|2026-01-01|2026-03-31": { id: "r-1", status: "APPROVED" },
      "INCOME_PRODUCTION|2026-01-01|2026-01-31": { id: "r-2", status: "NOT_STARTED" },
    };
    const items = buildCalendarYear(2026, existing, TODAY);
    const crrQ1 = items.find((i) => i.code === "CRR" && i.periodKey === "2026-Q1")!;
    expect(crrQ1.returnId).toBe("r-1");
    expect(crrQ1.status).toBe("APPROVED");
    expect(crrQ1.color).toBe("GREEN");
    const janIp = items.find((i) => i.code === "INCOME_PRODUCTION" && i.periodKey === "2026-01")!;
    expect(janIp.status).toBe("OVERDUE");
  });
});

describe("deriveDemoNotifications", () => {
  it("creates deadline, validation and workflow notifications", () => {
    const calendar = buildCalendarYear(2026, {}, TODAY);
    const notifications = deriveDemoNotifications(calendar, [
      {
        id: "r-1",
        name: "Commission & Rebate Returns",
        code: "CRR",
        periodLabel: "Q1 2026",
        status: "READY_FOR_REVIEW",
        createdAt: "2026-01-01T09:00:00.000Z",
        quality: { errorCount: 2, warningCount: 0, hasErrors: true },
      },
      {
        id: "r-2",
        name: "Commission & Rebate Returns",
        code: "CRR",
        periodLabel: "Q2 2026",
        status: "APPROVED",
        createdAt: "2026-01-02T09:00:00.000Z",
        quality: null,
      },
    ]);

    expect(notifications.some((n) => n.type === "DEADLINE" && n.title.includes("overdue"))).toBe(true);
    expect(notifications.some((n) => n.type === "DEADLINE" && n.title.includes("due soon"))).toBe(true);
    expect(notifications.some((n) => n.type === "VALIDATION" && n.title.includes("validation errors"))).toBe(true);
    expect(notifications.some((n) => n.type === "WORKFLOW" && n.title.includes("ready for review"))).toBe(true);
    expect(notifications.some((n) => n.type === "WORKFLOW" && n.title.includes("approved"))).toBe(true);
    expect(notifications.some((n) => n.type === "SYSTEM" && n.title.includes("confirmation"))).toBe(true);
    expect(notifications.some((n) => n.type === "SYSTEM" && n.title.includes("Welcome"))).toBe(true);
  });
});
