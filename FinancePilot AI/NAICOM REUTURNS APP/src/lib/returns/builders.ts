import type {
  PolicySource,
  ReturnData,
  ReturnRow,
  StaffSource,
} from "@/lib/returns/types";
import type { ReturnPeriod } from "@/lib/returns/periods";

function num(value: number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function daysBetween(from: string | null, to: string | null): number {
  if (!from || !to) return 0;
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

function text(value: string | null | undefined): string {
  return value === null || value === undefined || value === "" ? "—" : value;
}

function inPeriod(date: string | null, period: ReturnPeriod): boolean {
  if (!date) return false;
  return date >= period.start && date <= period.end;
}

function sortByDate(a: PolicySource, b: PolicySource): number {
  const da = a.transaction_date ?? "9999-12-31";
  const db = b.transaction_date ?? "9999-12-31";
  if (da !== db) return da.localeCompare(db);
  return (a.policy_number ?? "").localeCompare(b.policy_number ?? "");
}

// ------------------------------------------------------------------
// Income Production / PPS (same rows; different export layout)
// ------------------------------------------------------------------
export function buildIncomeProductionRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return policies
    .filter((p) => inPeriod(p.transaction_date, period))
    .sort(sortByDate)
    .map((p, i) => ({
      sn: i + 1,
      date: p.transaction_date,
      trans_ref: p.transaction_reference,
      policy_no: p.policy_number,
      endorsement: p.endorsement_number,
      trans_type: p.transaction_type,
      cover_from: p.cover_from,
      cover_to: p.cover_to,
      assured: p.insured_name,
      customer: text(p.client_name),
      broker: p.broker_or_agent,
      ledger_acc: p.ledger_account,
      sum_insured: num(p.sum_insured),
      gross_premium: num(p.gross_premium),
      brokerage: num(p.brokerage_commission),
      net_premium: num(p.net_premium),
      tenor: daysBetween(p.cover_from, p.cover_to),
      end_date: p.cover_to,
      debit_note: p.debit_note_number,
      credit_note: p.credit_note_number,
      amount_received: num(p.amount_received),
      date_receipt: p.premium_collection_date,
      receipt_no: p.receipt_number,
      bank: p.bank_name,
      date_lodgement: p.premium_collection_date,
      remittance: null,
      remarks: p.remarks,
    }));
}

// ------------------------------------------------------------------
// CRR — Commission & Rebate Returns
// Net commission rate = (commission − tax − other) / gross × 100
// Net premium = gross − commission − other deduction
// ------------------------------------------------------------------
export function buildCrrRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return policies
    .filter((p) => inPeriod(p.transaction_date, period))
    .sort(sortByDate)
    .map((p, i) => {
      const gross = num(p.gross_premium);
      const commission = num(p.brokerage_commission);
      const tax = num(p.tax);
      const other = num(p.other_deductions);
      const netRate =
        gross > 0 ? round2(((commission - tax - other) / gross) * 100) : num(p.commission_rate);
      return {
        sn: i + 1,
        date: p.transaction_date,
        policy_no: p.policy_number,
        risk_type: p.risk_type,
        client: text(p.client_name),
        insurer: text(p.insurer_name),
        sum_insured: num(p.sum_insured),
        gross_premium: gross,
        approved_rate: num(p.commission_rate),
        tax_paid: tax,
        net_rate: netRate,
        brokerage_commission: commission,
        other_deduction: other,
        net_premium: round2(gross - commission - other),
        amount_received: num(p.amount_received),
        receipt_no: p.receipt_number,
        remarks: p.remarks,
      };
    });
}

// ------------------------------------------------------------------
// Businesses Generated — half-yearly with NGN/USD splits
// ------------------------------------------------------------------
export function buildBusinessesGeneratedRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return policies
    .filter((p) => inPeriod(p.transaction_date, period))
    .sort(sortByDate)
    .map((p, i) => {
      const isUsd = p.currency === "USD";
      const pick = (value: number | null) => (isUsd ? null : num(value));
      const pickUsd = (value: number | null) => (isUsd ? num(value) : null);
      return {
        sn: i + 1,
        insured: text(p.insured_name),
        class_of_business: text(p.class_of_business),
        insurer: text(p.insurer_name),
        gp_ngn: pick(p.gross_premium),
        gp_usd: pickUsd(p.gross_premium),
        pc_ngn: pick(p.premium_collected),
        pc_usd: pickUsd(p.premium_collected),
        date_collection: p.premium_collection_date,
        pp_ngn: pick(p.premium_paid_to_insurer),
        pp_usd: pickUsd(p.premium_paid_to_insurer),
        date_paid: p.premium_payment_date,
        comm_ngn: pick(p.brokerage_commission),
        comm_usd: pickUsd(p.brokerage_commission),
      };
    });
}

// ------------------------------------------------------------------
// Personnel Returns — two schedules
// FIRST: staff on roll during the period.
// SECOND: previous / entry / exit / current per category.
// ------------------------------------------------------------------
export const PERSONNEL_CATEGORIES = [
  "JUNIOR STAFF",
  "SENIOR STAFF",
  "LOWER MANAGEMENT",
  "SENIOR MANAGEMENT",
] as const;

function staffOnRollDuring(staff: StaffSource[], period: ReturnPeriod): StaffSource[] {
  return staff.filter((s) => {
    const employed = s.date_of_employment;
    if (!employed || employed > period.end) return false;
    return !s.date_of_exit || s.date_of_exit >= period.start;
  });
}

function summaryNumbers(staff: StaffSource[], period: ReturnPeriod) {
  const start = period.start;
  const end = period.end;

  const previous = staff.filter(
    (s) =>
      s.date_of_employment && s.date_of_employment < start &&
      (!s.date_of_exit || s.date_of_exit > start)
  ).length;
  const entry = staff.filter((s) => s.date_of_employment && s.date_of_employment >= start && s.date_of_employment <= end).length;
  const exit = staff.filter((s) => s.date_of_exit && s.date_of_exit >= start && s.date_of_exit <= end).length;
  const current = staff.filter(
    (s) =>
      s.date_of_employment && s.date_of_employment <= end &&
      (!s.date_of_exit || s.date_of_exit > end)
  ).length;
  return { previous, entry, exit, current };
}

export function buildPersonnelRows(staff: StaffSource[], period: ReturnPeriod): ReturnRow[] {
  const first = staffOnRollDuring(staff, period)
    .slice()
    .sort((a, b) => a.staff_name.localeCompare(b.staff_name))
    .map((s, i) => ({
      schedule: "FIRST",
      sn: i + 1,
      staff_name: s.staff_name,
      staff_category: text(s.staff_category),
      designation: text(s.designation),
      gender: text(s.gender),
      educational_qualification: text(s.educational_qualification),
      professional_qualification: text(s.professional_qualification),
      date_of_employment: s.date_of_employment,
      state_of_origin: text(s.state_of_origin),
      location: text(s.location),
      date_of_exit: s.date_of_exit,
      reason_for_leaving: s.reason_for_leaving,
    }));

  const byCategory = new Map<string, StaffSource[]>();
  for (const cat of PERSONNEL_CATEGORIES) {
    byCategory.set(cat, []);
  }
  for (const s of staff) {
    const cat = s.staff_category ?? "UNCATEGORISED";
    const bucket = byCategory.get(cat);
    if (bucket) bucket.push(s);
    else byCategory.set(cat, [s]);
  }

  let totalPrev = 0;
  let totalEntry = 0;
  let totalExit = 0;
  let totalCurrent = 0;
  const second: ReturnRow[] = [];
  for (const cat of [...PERSONNEL_CATEGORIES, "UNCATEGORISED"]) {
    const rows = byCategory.get(cat) ?? [];
    const n = summaryNumbers(rows, period);
    second.push({
      schedule: "SECOND",
      category: cat,
      previous: n.previous,
      entry: n.entry,
      exit: n.exit,
      current: n.current,
    });
    if (cat !== "UNCATEGORISED") {
      totalPrev += n.previous;
      totalEntry += n.entry;
      totalExit += n.exit;
      totalCurrent += n.current;
    }
  }
  second.push({
    schedule: "SECOND",
    category: "TOTAL",
    previous: totalPrev,
    entry: totalEntry,
    exit: totalExit,
    current: totalCurrent,
  });

  return [...first, ...second];
}

// ------------------------------------------------------------------
// Form 1C — insurer-grouped premium summary
// ------------------------------------------------------------------
export function buildForm1CRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  const inRange = policies.filter((p) => inPeriod(p.transaction_date, period));
  const byInsurer = new Map<string, ReturnRow>();
  for (const p of inRange) {
    const name = text(p.insurer_name);
    const existing = byInsurer.get(name) ?? {
      gross_premium: 0,
      collected: 0,
      paid: 0,
      commission: 0,
      policy_count: 0,
    };
    existing.gross_premium = round2((existing.gross_premium as number) + num(p.gross_premium));
    existing.collected = round2((existing.collected as number) + num(p.premium_collected));
    existing.paid = round2((existing.paid as number) + num(p.premium_paid_to_insurer));
    existing.commission = round2((existing.commission as number) + num(p.brokerage_commission));
    existing.policy_count = (existing.policy_count as number) + 1;
    byInsurer.set(name, existing);
  }

  return [...byInsurer.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([insurer, row], i) => ({
      item: i + 1,
      insurer,
      gross_premium: row.gross_premium,
      collected: row.collected,
      paid: row.paid,
      commission: row.commission,
      policy_count: row.policy_count,
    }));
}

// ------------------------------------------------------------------
// Brokerage Commission Register — annual register of commission earned
// Net commission received = commission earned − withholding tax (WHT)
// ------------------------------------------------------------------
export function buildBrokerageCommissionRows(
  policies: PolicySource[],
  period: ReturnPeriod
): ReturnRow[] {
  return policies
    .filter((p) => inPeriod(p.transaction_date, period))
    .sort(sortByDate)
    .map((p, i) => {
      const commission = num(p.brokerage_commission);
      const tax = num(p.tax);
      return {
        sn: i + 1,
        client: text(p.client_name),
        insurer: text(p.insurer_name),
        policy_no: p.policy_number,
        class_of_business: text(p.class_of_business),
        date: p.transaction_date,
        sum_insured: num(p.sum_insured),
        gross_premium: num(p.gross_premium),
        commission_rate: num(p.commission_rate),
        commission_earned: commission,
        withholding_tax: tax,
        net_commission: round2(commission - tax),
        date_received: p.premium_payment_date ?? p.premium_collection_date,
        receipt_no: p.receipt_number,
        remarks: p.remarks,
      };
    });
}

// ------------------------------------------------------------------
// Dispatch
// ------------------------------------------------------------------
export function buildReturnRows(code: string, data: ReturnData, period: ReturnPeriod): ReturnRow[] {
  switch (code) {
    case "INCOME_PRODUCTION":
    case "PPS":
      return buildIncomeProductionRows(data.policies, period);
    case "CRR":
      return buildCrrRows(data.policies, period);
    case "BUSINESSES_GENERATED":
      return buildBusinessesGeneratedRows(data.policies, period);
    case "PERSONNEL":
      return buildPersonnelRows(data.staff, period);
    case "FORM_1C":
      return buildForm1CRows(data.policies, period);
    case "BROKERAGE_COMMISSION":
      return buildBrokerageCommissionRows(data.policies, period);
    default:
      throw new Error(`Unknown return code: ${code}`);
  }
}
