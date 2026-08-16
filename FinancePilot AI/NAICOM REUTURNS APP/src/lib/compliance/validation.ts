import type { ReturnRow } from "@/lib/returns/types";

export type ValidationSeverity = "ERROR" | "WARNING" | "INFO";

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  rowIndex: number | null;
  field: string | null;
  message: string;
}

export interface ValidationResult {
  score: number;
  passedChecks: number;
  totalChecks: number;
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  hasErrors: boolean;
}

interface ReturnValidationConfig {
  required: Record<string, string>;
  money: string[];
  dates: string[];
}

const VALIDATION_CONFIGS: Record<string, ReturnValidationConfig> = {
  INCOME_PRODUCTION: {
    required: { policy_no: "Policy No", date: "Date", assured: "Assured", gross_premium: "Gross premium" },
    money: ["sum_insured", "gross_premium", "brokerage", "net_premium", "amount_received"],
    dates: ["date", "cover_from", "cover_to", "end_date", "date_receipt", "date_lodgement"],
  },
  PPS: {
    required: { policy_no: "Policy No", assured: "Assured", gross_premium: "Gross premium" },
    money: ["sum_insured", "gross_premium", "brokerage", "net_premium", "amount_received", "remittance", "unremitted"],
    dates: ["cover_from", "cover_to", "date_receipt", "remittance_date"],
  },
  CRR: {
    required: { policy_no: "Policy No", client: "Name of Client", insurer: "Name of Insurer", gross_premium: "Gross premium", brokerage_commission: "Brokerage commission" },
    money: ["sum_insured", "gross_premium", "tax_paid", "brokerage_commission", "other_deduction", "net_premium", "amount_received"],
    dates: ["date"],
  },
  BUSINESSES_GENERATED: {
    required: { insured: "Insured", insurer: "Insurer", class_of_business: "Class of Business" },
    money: ["gp_ngn", "gp_usd", "pc_ngn", "pc_usd", "pp_ngn", "pp_usd", "comm_ngn", "comm_usd"],
    dates: ["date_collection", "date_paid"],
  },
  FORM_1C: {
    required: { insurer: "Insurer", gross_premium: "Gross premium" },
    money: ["gross_premium", "collected", "paid", "commission"],
    dates: [],
  },
  BROKERAGE_COMMISSION: {
    required: { client: "Name of Client", insurer: "Name of Insurer", policy_no: "Policy No", commission_earned: "Commission earned" },
    money: ["sum_insured", "gross_premium", "commission_earned", "withholding_tax", "net_commission"],
    dates: ["date", "date_received"],
  },
  PERSONNEL: {
    required: {},
    money: [],
    dates: [],
  },
};

const PERSONNEL_REQUIRED = {
  staff_name: "Name of Staff",
  staff_category: "Staff Category",
  designation: "Designation",
  date_of_employment: "Date of Employment",
};

function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function isValidDate(value: unknown): boolean {
  if (isEmpty(value)) return true;
  const d = new Date(String(value));
  return !Number.isNaN(d.getTime());
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function validateReturn(code: string, rows: ReturnRow[]): ValidationResult {
  const issues: ValidationIssue[] = [];
  let passedChecks = 0;
  let totalChecks = 0;

  const config = VALIDATION_CONFIGS[code];

  if (code === "PERSONNEL") {
    validatePersonnel(rows, issues, () => totalChecks++, () => passedChecks++);
    return summarize(issues, totalChecks, passedChecks);
  }

  const policyNos = new Map<string, number>();
  const duplicateRows: number[] = [];

  rows.forEach((row, i) => {
    const rowNo = i + 1;

    for (const [key, label] of Object.entries(config.required)) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        totalChecks++;
        if (isEmpty(row[key])) {
          issues.push({
            code: "MISSING_FIELD",
            severity: "ERROR",
            rowIndex: i,
            field: key,
            message: `Missing ${label} in row ${rowNo}.`,
          });
        } else {
          passedChecks++;
        }
      }
    }

    for (const key of config.money) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        totalChecks++;
        const value = Number(row[key]);
        if (Number.isNaN(value)) {
          issues.push({
            code: "NOT_A_NUMBER",
            severity: "ERROR",
            rowIndex: i,
            field: key,
            message: `"${row[key]}" is not a valid amount in row ${rowNo}. Enter a number such as 12,500,000.`,
          });
        } else if (value < 0) {
          issues.push({
            code: "NEGATIVE_AMOUNT",
            severity: "ERROR",
            rowIndex: i,
            field: key,
            message: `Negative amount ${value} in ${key} (row ${rowNo}).`,
          });
        } else {
          passedChecks++;
        }
      }
    }

    for (const key of config.dates) {
      if (Object.prototype.hasOwnProperty.call(row, key) && !isEmpty(row[key])) {
        totalChecks++;
        if (isValidDate(row[key])) {
          passedChecks++;
        } else {
          issues.push({
            code: "INVALID_DATE",
            severity: "ERROR",
            rowIndex: i,
            field: key,
            message: `Invalid date "${row[key]}" in ${key} (row ${rowNo}).`,
          });
        }
      }
    }

    if (
      !isEmpty(row.cover_from) &&
      !isEmpty(row.cover_to) &&
      isValidDate(row.cover_from) &&
      isValidDate(row.cover_to)
    ) {
      totalChecks++;
      const from = new Date(String(row.cover_from)).getTime();
      const to = new Date(String(row.cover_to)).getTime();
      if (from <= to) {
        passedChecks++;
      } else {
        issues.push({
          code: "IMPLAUSIBLE_RANGE",
          severity: "ERROR",
          rowIndex: i,
          field: "cover_from",
          message: `Cover period is reversed in row ${rowNo}: cover_from (${row.cover_from}) is after cover_to (${row.cover_to}).`,
        });
      }
    }

    if (
      !isEmpty(row.premium_collected) &&
      !isEmpty(row.gross_premium) &&
      !Number.isNaN(Number(row.premium_collected)) &&
      !Number.isNaN(Number(row.gross_premium))
    ) {
      totalChecks++;
      if (Number(row.premium_collected) <= Number(row.gross_premium)) {
        passedChecks++;
      } else {
        issues.push({
          code: "COLLECTION_EXCEEDS_EXPECTED",
          severity: "WARNING",
          rowIndex: i,
          field: "premium_collected",
          message: `Premium collected (${Number(row.premium_collected).toLocaleString()}) exceeds gross premium (${Number(row.gross_premium).toLocaleString()}) in row ${rowNo}.`,
        });
      }
    }

    if (
      !isEmpty(row.premium_paid_to_insurer) &&
      !isEmpty(row.premium_collected) &&
      !Number.isNaN(Number(row.premium_paid_to_insurer)) &&
      !Number.isNaN(Number(row.premium_collected))
    ) {
      totalChecks++;
      if (Number(row.premium_paid_to_insurer) <= Number(row.premium_collected)) {
        passedChecks++;
      } else {
        issues.push({
          code: "PAID_EXCEEDS_COLLECTED",
          severity: "WARNING",
          rowIndex: i,
          field: "premium_paid_to_insurer",
          message: `Premium paid to insurer (${Number(row.premium_paid_to_insurer).toLocaleString()}) exceeds premium collected (${Number(row.premium_collected).toLocaleString()}) in row ${rowNo}.`,
        });
      }
    }

    const gross = Number(row.gross_premium);
    const rate = Number(row.approved_rate ?? row.commission_rate);
    const commissionField =
      row.brokerage_commission !== undefined ? row.brokerage_commission : row.commission_earned;
    const commission = Number(commissionField);
    if (
      !isEmpty(commissionField) &&
      !Number.isNaN(gross) &&
      !Number.isNaN(rate) &&
      !Number.isNaN(commission)
    ) {
      totalChecks++;
      const expected = (gross * rate) / 100;
      if (Math.abs(commission - expected) <= 1) {
        passedChecks++;
      } else {
        issues.push({
          code: "COMMISSION_INCONSISTENT_WITH_RATE",
          severity: "WARNING",
          rowIndex: i,
          field: row.brokerage_commission !== undefined ? "brokerage_commission" : "commission_earned",
          message: `Commission (${commission.toLocaleString()}) is inconsistent with rate ${rate}% × gross (${expected.toLocaleString()}) in row ${rowNo}.`,
        });
      }
    }

    if (
      !isEmpty(row.commission_earned) &&
      !isEmpty(row.withholding_tax) &&
      !isEmpty(row.net_commission) &&
      !Number.isNaN(Number(row.commission_earned)) &&
      !Number.isNaN(Number(row.withholding_tax)) &&
      !Number.isNaN(Number(row.net_commission))
    ) {
      totalChecks++;
      const expectedNet = round2(Number(row.commission_earned) - Number(row.withholding_tax));
      if (Math.abs(Number(row.net_commission) - expectedNet) <= 1) {
        passedChecks++;
      } else {
        issues.push({
          code: "NET_COMMISSION_DISCREPANCY",
          severity: "WARNING",
          rowIndex: i,
          field: "net_commission",
          message: `Net commission (${Number(row.net_commission).toLocaleString()}) does not equal commission earned − withholding tax (${expectedNet.toLocaleString()}) in row ${rowNo}.`,
        });
      }
    }

    if (!isEmpty(row.policy_no)) {
      const p = String(row.policy_no).trim();
      if (policyNos.has(p)) {
        duplicateRows.push(i);
      } else {
        policyNos.set(p, i);
      }
    }

    const present = Object.entries(row).some(([, v]) => !isEmpty(v));
    if (!present) {
      issues.push({
        code: "BLANK_ROW",
        severity: "INFO",
        rowIndex: i,
        field: null,
        message: `Row ${rowNo} is blank and will be treated as empty.`,
      });
    }
  });

  if (policyNos.size > 0) {
    totalChecks++;
    if (duplicateRows.length === 0) {
      passedChecks++;
    } else {
      const seen = new Set<string>();
      const duplicates = rows
        .map((row, i) => ({ p: String(row.policy_no).trim(), i }))
        .filter((r) => {
          if (seen.has(r.p)) return true;
          seen.add(r.p);
          return false;
        });
      for (const d of duplicates) {
        issues.push({
          code: "DUPLICATE_POLICY",
          severity: "ERROR",
          rowIndex: d.i,
          field: "policy_no",
          message: `Duplicate policy number "${d.p}" in the return. Confirm to keep or remove the duplicate.`,
        });
      }
    }
  }

  return summarize(issues, totalChecks, passedChecks);
}

function validatePersonnel(
  rows: ReturnRow[],
  issues: ValidationIssue[],
  bumpTotal: () => void,
  bumpPassed: () => void
): void {
  rows.forEach((row, i) => {
    const rowNo = i + 1;
    if (row.schedule === "SECOND") {
      const { previous, entry, exit, current } = row as {
        previous?: unknown;
        entry?: unknown;
        exit?: unknown;
        current?: unknown;
      };
      if (!isEmpty(previous) && !isEmpty(entry) && !isEmpty(exit) && !isEmpty(current)) {
        bumpTotal();
        const expected = Number(previous) + Number(entry) - Number(exit);
        if (expected === Number(current)) {
          bumpPassed();
        } else {
          issues.push({
            code: "PERSONNEL_HEADCOUNT_DISCREPANCY",
            severity: "WARNING",
            rowIndex: i,
            field: "current",
            message: `Headcount for "${String(row.category)}" does not reconcile: previous + entry − exit (${expected}) ≠ current (${Number(current)}).`,
          });
        }
      }
      return;
    }

    for (const [key, label] of Object.entries(PERSONNEL_REQUIRED)) {
      if (Object.prototype.hasOwnProperty.call(row, key)) {
        bumpTotal();
        if (isEmpty(row[key])) {
          issues.push({
            code: "MISSING_FIELD",
            severity: "ERROR",
            rowIndex: i,
            field: key,
            message: `Missing ${label} in row ${rowNo}.`,
          });
        } else {
          bumpPassed();
        }
      }
    }

    for (const key of ["date_of_employment", "date_of_exit"]) {
      if (Object.prototype.hasOwnProperty.call(row, key) && !isEmpty(row[key])) {
        bumpTotal();
        if (isValidDate(row[key])) {
          bumpPassed();
        } else {
          issues.push({
            code: "INVALID_DATE",
            severity: "ERROR",
            rowIndex: i,
            field: key,
            message: `Invalid date "${row[key]}" in ${key} (row ${rowNo}).`,
          });
        }
      }
    }
  });
}

function summarize(
  issues: ValidationIssue[],
  totalChecks: number,
  passedChecks: number
): ValidationResult {
  const errorCount = issues.filter((i) => i.severity === "ERROR").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  return {
    score: totalChecks === 0 ? 100 : round2((passedChecks / totalChecks) * 100),
    passedChecks,
    totalChecks,
    issues,
    errorCount,
    warningCount,
    hasErrors: errorCount > 0,
  };
}
