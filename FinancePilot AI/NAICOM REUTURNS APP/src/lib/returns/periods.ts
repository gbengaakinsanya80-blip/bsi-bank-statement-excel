import type { ReturnFrequency } from "@/lib/returns/definitions";

export interface ReturnPeriod {
  key: string;
  label: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const QUARTER_RANGES: [string, string][] = [
  ["01-01", "03-31"],
  ["04-01", "06-30"],
  ["07-01", "09-30"],
  ["10-01", "12-31"],
];

const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number): string {
  return `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`;
}

export function monthlyPeriod(year: number, month: number): ReturnPeriod {
  return {
    key: `${year}-${pad(month)}`,
    label: `${MONTH_LABELS[month - 1]} ${year}`,
    start: `${year}-${pad(month)}-01`,
    end: lastDayOfMonth(year, month),
  };
}

export function quarterlyPeriod(year: number, quarter: number): ReturnPeriod {
  return {
    key: `${year}-Q${quarter}`,
    label: `Q${quarter} ${year}`,
    start: `${year}-${QUARTER_RANGES[quarter - 1][0]}`,
    end: `${year}-${QUARTER_RANGES[quarter - 1][1]}`,
  };
}

export function halfYearlyPeriod(year: number, half: "H1" | "H2" | "FY"): ReturnPeriod {
  const range =
    half === "H1" ? ["01-01", "06-30"] : half === "H2" ? ["07-01", "12-31"] : ["01-01", "12-31"];
  return {
    key: `${year}-${half}`,
    label: half === "FY" ? `Full Year ${year}` : `${half} ${year}`,
    start: `${year}-${range[0]}`,
    end: `${year}-${range[1]}`,
  };
}

export function annualPeriod(year: number): ReturnPeriod {
  return {
    key: `${year}-FY`,
    label: `Full Year ${year}`,
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

export function adHocPeriod(start: string, end: string): ReturnPeriod {
  return {
    key: `${start}_to_${end}`,
    label: `${start} to ${end}`,
    start,
    end,
  };
}

export function buildPeriod(frequency: ReturnFrequency, key: string): ReturnPeriod {
  switch (frequency) {
    case "MONTHLY": {
      const m = /^(\d{4})-(\d{2})$/.exec(key);
      if (!m) throw new Error(`Invalid monthly period key: ${key}`);
      return monthlyPeriod(Number(m[1]), Number(m[2]));
    }
    case "QUARTERLY": {
      const q = /^(\d{4})-Q([1-4])$/.exec(key);
      if (!q) throw new Error(`Invalid quarterly period key: ${key}`);
      return quarterlyPeriod(Number(q[1]), Number(q[2]));
    }
    case "HALF_YEARLY": {
      const h = /^(\d{4})-(H1|H2|FY)$/.exec(key);
      if (!h) throw new Error(`Invalid half-yearly period key: ${key}`);
      return halfYearlyPeriod(Number(h[1]), h[2] as "H1" | "H2" | "FY");
    }
    case "AD_HOC": {
      const r = /^(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})$/.exec(key);
      if (!r) throw new Error(`Invalid ad-hoc period key: ${key}`);
      return adHocPeriod(r[1], r[2]);
    }
    case "ANNUAL": {
      const a = /^(\d{4})-FY$/.exec(key);
      if (!a) throw new Error(`Invalid annual period key: ${key}`);
      return annualPeriod(Number(a[1]));
    }
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }
}

export function periodsForFrequency(frequency: ReturnFrequency, year: number): ReturnPeriod[] {
  switch (frequency) {
    case "MONTHLY":
      return Array.from({ length: 12 }, (_, i) => monthlyPeriod(year, i + 1));
    case "QUARTERLY":
      return [1, 2, 3, 4].map((q) => quarterlyPeriod(year, q));
    case "HALF_YEARLY":
      return [halfYearlyPeriod(year, "H1"), halfYearlyPeriod(year, "H2"), halfYearlyPeriod(year, "FY")];
    case "ANNUAL":
      return [annualPeriod(year)];
    case "AD_HOC":
      return [];
  }
}

export function periodYearOptions(): number[] {
  const years: number[] = [];
  for (let y = 2020; y <= 2030; y++) years.push(y);
  return years;
}
