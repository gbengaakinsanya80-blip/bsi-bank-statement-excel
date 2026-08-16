import type { ReturnDefinition, ReturnFrequency } from "@/lib/returns/definitions";
import { RETURN_DEFINITIONS } from "@/lib/returns/definitions";
import { periodsForFrequency, buildPeriod } from "@/lib/returns/periods";
import { COMPLETED_STATUSES } from "@/lib/returns/status";

export interface DueDateRule {
  frequency: ReturnFrequency;
  day_of_month?: number;
  days_after_period_end?: number;
  due_month?: number;
  due_day?: number;
  fixed_date?: string;
  confirmed?: boolean;
  source?: string;
}

export const DEFAULT_DUE_DATE_RULES: Record<string, DueDateRule> = {
  INCOME_PRODUCTION: {
    frequency: "MONTHLY",
    day_of_month: 15,
    confirmed: true,
    source: "NAICOM monthly returns guideline",
  },
  PPS: {
    frequency: "MONTHLY",
    day_of_month: 15,
    confirmed: true,
    source: "NAICOM monthly returns guideline",
  },
  CRR: {
    frequency: "QUARTERLY",
    days_after_period_end: 21,
    confirmed: true,
    source: "NAICOM quarterly returns directive",
  },
  BUSINESSES_GENERATED: {
    frequency: "HALF_YEARLY",
    days_after_period_end: 30,
    confirmed: true,
    source: "NAICOM half-yearly returns directive",
  },
  PERSONNEL: {
    frequency: "QUARTERLY",
    days_after_period_end: 21,
    confirmed: true,
    source: "NAICOM personnel returns directive",
  },
  FORM_1C: {
    frequency: "AD_HOC",
    fixed_date: "2026-03-31",
    confirmed: false,
    source: "NAICOM circular — deadline to be confirmed",
  },
  BROKERAGE_COMMISSION: {
    frequency: "ANNUAL",
    due_month: 1,
    due_day: 31,
    confirmed: true,
    source: "NAICOM annual returns — due 31 January of the following year",
  },
};

const DAY = 24 * 60 * 60 * 1000;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const t = new Date(Date.UTC(year, month - 1, day + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function computeDueDate(rule: DueDateRule | undefined, period: {
  start: string;
  end: string;
}): string | null {
  if (!rule || rule.confirmed === false) return null;

  if (rule.frequency === "AD_HOC" && rule.fixed_date) return rule.fixed_date;

  if (rule.frequency === "MONTHLY" && rule.day_of_month) {
    const [year, month] = period.end.split("-").map(Number);
    const day = Math.min(rule.day_of_month, lastDayOfMonth(year, month));
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  if (rule.days_after_period_end !== undefined) {
    return addDays(period.end, rule.days_after_period_end);
  }

  if (rule.frequency === "ANNUAL" && rule.due_month && rule.due_day) {
    const year = Number(period.end.split("-")[0]);
    return `${year + 1}-${pad(rule.due_month)}-${pad(rule.due_day)}`;
  }

  return null;
}

export type CalendarColor = "RED" | "ORANGE" | "YELLOW" | "GREEN" | "GREY";

export interface CalendarItem {
  id: string;
  code: string;
  name: string;
  frequency: ReturnFrequency;
  periodKey: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  requiresConfirmation: boolean;
  daysRemaining: number | null;
  status: string;
  color: CalendarColor;
  colorLabel: string;
  returnId: string | null;
}

export interface ExistingReturnRef {
  id: string;
  status: string;
}

export function daysUntil(dueDate: string, today: Date): number {
  const [dueY, dueM, dueD] = dueDate.split("-").map(Number);
  const due = Date.UTC(dueY, dueM - 1, dueD);
  const now = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate()
  );
  return Math.round((due - now) / DAY);
}

export function colorForCalendarItem(
  status: string,
  dueDate: string | null,
  today: Date
): { color: CalendarColor; colorLabel: string } {
  if (COMPLETED_STATUSES.includes(status)) {
    return { color: "GREEN", colorLabel: "Completed" };
  }
  if (!dueDate) {
    return { color: "GREY", colorLabel: "Deadline requires confirmation" };
  }
  const remaining = daysUntil(dueDate, today);
  if (remaining < 0) {
    return { color: "RED", colorLabel: "Overdue" };
  }
  if (remaining <= 7) {
    return { color: "ORANGE", colorLabel: `Due in ${remaining === 0 ? "0" : remaining} day${remaining === 1 ? "" : "s"}` };
  }
  if (remaining <= 14) {
    return { color: "YELLOW", colorLabel: `Due in ${remaining} days` };
  }
  return { color: "GREY", colorLabel: "Not due yet" };
}

export function statusForCalendarItem(
  status: string,
  dueDate: string | null,
  today: Date
): string {
  if (COMPLETED_STATUSES.includes(status)) return status;
  if (status !== "NOT_STARTED") return status;
  if (!dueDate) return "NOT_STARTED";
  return daysUntil(dueDate, today) < 0 ? "OVERDUE" : "NOT_STARTED";
}

export function buildCalendar(
  definitions: Pick<ReturnDefinition, "code" | "name" | "frequency">[],
  year: number,
  existing: Record<string, ExistingReturnRef> = {},
  today: Date = new Date(),
  rules: Record<string, DueDateRule> = DEFAULT_DUE_DATE_RULES
): CalendarItem[] {
  const items: CalendarItem[] = [];

  for (const def of definitions) {
    const rule = rules[def.code];
    const periods =
      def.frequency === "AD_HOC"
        ? [buildPeriod("AD_HOC", `${year}-01-01_to_${year}-12-31`)]
        : periodsForFrequency(def.frequency, year);

    for (const period of periods) {
      const key = `${def.code}|${period.start}|${period.end}`;
      const linked = existing[key];
      const dueDate = computeDueDate(rule, period);
      const baseStatus = linked?.status ?? "NOT_STARTED";
      const effectiveStatus = statusForCalendarItem(baseStatus, dueDate, today);
      const { color, colorLabel } = colorForCalendarItem(effectiveStatus, dueDate, today);

      items.push({
        id: key,
        code: def.code,
        name: def.name,
        frequency: def.frequency,
        periodKey: period.key,
        periodLabel: period.label,
        periodStart: period.start,
        periodEnd: period.end,
        dueDate,
        requiresConfirmation: !rule || rule.confirmed === false,
        daysRemaining: dueDate ? daysUntil(dueDate, today) : null,
        status: effectiveStatus,
        color,
        colorLabel,
        returnId: linked?.id ?? null,
      });
    }
  }

  return items.sort((a, b) => {
    const order: Record<string, number> = { RED: 0, ORANGE: 1, YELLOW: 2, GREY: 3, GREEN: 4 };
    if (order[a.color] !== order[b.color]) return order[a.color] - order[b.color];
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return a.name.localeCompare(b.name);
  });
}

export function buildCalendarYear(
  year: number,
  existing: Record<string, ExistingReturnRef> = {},
  today: Date = new Date(),
  rules: Record<string, DueDateRule> = DEFAULT_DUE_DATE_RULES
): CalendarItem[] {
  return buildCalendar(RETURN_DEFINITIONS, year, existing, today, rules);
}

export const CALENDAR_COLOR_META: Record<CalendarColor, { label: string; dot: string; badge: string }> = {
  RED: { label: "Overdue", dot: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-200" },
  ORANGE: { label: "Due within 7 days", dot: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-200" },
  YELLOW: { label: "Due within 14 days", dot: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  GREEN: { label: "Completed", dot: "bg-green-500", badge: "bg-green-100 text-green-700 border-green-200" },
  GREY: { label: "Not due / requires confirmation", dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground border-muted" },
};
