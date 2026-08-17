import type {
  PolicySource,
  ClaimSource,
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
// New / Renewal Policies — monthly schedules of policy movement
// Premium Due Date = cover start (premium falls due at inception).
// Renewal Due Date = cover end (expiry drives the next renewal).
// ------------------------------------------------------------------
function buildPolicyScheduleRows(
  policies: PolicySource[],
  period: ReturnPeriod,
  transactionType: "NEW" | "RENEWAL"
): ReturnRow[] {
  return policies
    .filter(
      (p) =>
        (p.transaction_type ?? "").toUpperCase() === transactionType &&
        inPeriod(p.transaction_date, period)
    )
    .sort(sortByDate)
    .map((p, i) => ({
      sn: i + 1,
      policy_no: p.policy_number,
      trans_ref: p.transaction_reference,
      transaction_date: p.transaction_date,
      client: text(p.client_name),
      insured: text(p.insured_name),
      insurer: text(p.insurer_name),
      class_of_business: text(p.class_of_business),
      risk_type: text(p.risk_type),
      sum_insured: num(p.sum_insured),
      gross_premium: num(p.gross_premium),
      premium_collected: num(p.premium_collected),
      premium_paid_to_insurer: num(p.premium_paid_to_insurer),
      brokerage_commission: num(p.brokerage_commission),
      tax: num(p.tax),
      net_premium: num(p.net_premium),
      premium_due_date: p.cover_from ?? p.transaction_date,
      cover_from: p.cover_from,
      cover_to: p.cover_to,
      renewal_due_date: p.cover_to ?? null,
      premium_collection_date: p.premium_collection_date,
      premium_payment_date: p.premium_payment_date,
      receipt_no: p.receipt_number,
      bank: text(p.bank_name),
      currency: p.currency || "NGN",
      branch: text(p.branch_location),
      remarks: p.remarks,
    }));
}

export function buildNewPoliciesRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return buildPolicyScheduleRows(policies, period, "NEW");
}

export function buildRenewalPoliciesRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return buildPolicyScheduleRows(policies, period, "RENEWAL");
}

// ------------------------------------------------------------------
// Form 7.2B — Statement of Business Generated (half-yearly)
// Columns follow the NAICOM 7.2B layout:
//   (a) premium paid directly to insurers
//   (b) premium paid to the broker (local), (c) foreign
//   (d) total gross premium = (a) + (b) + (c)
//   (e) net premium = (d) − total commission fee income
//
// Commission earned uses time-based apportionment:
//   (j) earned = (RD − SD) / (ED − SD) × commission due to reporting broker
//   (k) deferred = commission due to reporting broker − earned
// where RD = reporting date (period.end), SD = cover start, ED = cover end.
// ------------------------------------------------------------------
function policyMonth(p: PolicySource): string {
  const base = p.transaction_date ?? p.cover_from ?? null;
  return base && base.length >= 7 ? base.slice(0, 7) : "—";
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildForm72BRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return policies
    .filter((p) => inPeriod(p.transaction_date, period))
    .sort(sortByDate)
    .map((p, i) => {
      const gross = num(p.gross_premium);
      const collected = num(p.premium_collected);
      const commission = num(p.brokerage_commission);
      const isUsd = p.currency === "USD";
      const paidDirectly = round2(Math.max(gross - collected, 0));
      const paidToBrokersLocal = isUsd ? 0 : collected;
      const paidToBrokersForeign = isUsd ? collected : 0;
      const totalGross = round2(paidDirectly + paidToBrokersLocal + paidToBrokersForeign);
      const totalCommission = commission;
      const netPremium = round2(totalGross - totalCommission);
      const coverDays = daysBetween(p.cover_from, p.cover_to);
      const elapsedDays = daysBetween(p.cover_from, period.end);
      const apportionmentRatio = coverDays > 0 ? clamp01(elapsedDays / coverDays) : 0;
      const commissionEarned = round2(commission * apportionmentRatio);
      return {
        month: policyMonth(p),
        sn: i + 1,
        name_of_insured: text(p.insured_name ?? p.policy_number),
        insurer: text(p.insurer_name),
        sd: p.cover_from,
        ed: p.cover_to,
        sum_insured: num(p.sum_insured),
        premium_paid_directly: paidDirectly,
        premium_paid_to_brokers_local: paidToBrokersLocal,
        premium_paid_to_brokers_foreign: paidToBrokersForeign,
        total_gross_premium: totalGross,
        net_premium: netPremium,
        clients_bank: num(p.amount_received),
        date_received: p.premium_collection_date,
        premium_received_by_broker: collected,
        total_commission_fee: totalCommission,
        commission_due_to_cobrokers: 0,
        commission_due_to_reporting: round2(totalCommission),
        commission_income_earned: commissionEarned,
        deferred_commission: round2(commission - commissionEarned),
      };
    });
}

// ------------------------------------------------------------------
// Form 7.2C — Schedule of Remittances (half-yearly)
// Columns follow the NAICOM 7.2C layout and the form's own
// outstanding-payment formulas:
//   (m) = (b) − (i)   outstanding premium due to insurers
//   (n) = (c′) + (d) + (e′) − (j)  outstanding claims/returned premium/deposit
//   (o) = (f) − (k)   outstanding VAT due to FIRS/SIRS
//   (p) = (g) + (h) − (L)  outstanding commission due to co/reporting broker
// ------------------------------------------------------------------
export function buildForm72CRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return policies
    .filter((p) => inPeriod(p.transaction_date, period))
    .sort(sortByDate)
    .map((p, i) => {
      const collected = num(p.premium_collected);
      const paidToInsurer = num(p.premium_paid_to_insurer);
      const commission = num(p.brokerage_commission);
      const totalReceived = collected;
      const premiumDueToInsurers = round2(collected - commission);
      const depositByInsured = 0;
      const returnedPremiumDue = 0;
      const claimsDue = 0;
      const vatDue = 0;
      const commissionDueToCobrokers = 0;
      const commissionDueReporting = commission;
      const remittanceRatio = collected > 0 ? clamp01(paidToInsurer / collected) : 0;
      const premiumRemitted = paidToInsurer;
      const claimsRemitted = 0;
      const vatRemitted = 0;
      const commissionRemitted = round2(commission * remittanceRatio);
      return {
        month: policyMonth(p),
        sn: i + 1,
        name_of_insured: text(p.insured_name ?? p.policy_number),
        insurer: text(p.insurer_name),
        sd: p.cover_from,
        ed: p.cover_to,
        total_received: totalReceived,
        premium_due_to_insurers: premiumDueToInsurers,
        deposit_by_insured: depositByInsured,
        returned_premium_due: returnedPremiumDue,
        claims_due: claimsDue,
        vat_due: vatDue,
        commission_due_cobrokers: commissionDueToCobrokers,
        commission_due_reporting: commissionDueReporting,
        date_remitted: p.premium_payment_date ?? p.premium_collection_date,
        paying_bank: text(p.bank_name),
        premium_remitted: premiumRemitted,
        claims_remitted: claimsRemitted,
        vat_remitted: vatRemitted,
        commission_remitted: commissionRemitted,
        outstanding_premium: round2(premiumDueToInsurers - premiumRemitted),
        outstanding_claims: round2(
          depositByInsured + returnedPremiumDue + claimsDue - claimsRemitted
        ),
        outstanding_vat: round2(vatDue - vatRemitted),
        outstanding_commission: round2(
          commissionDueToCobrokers + commissionDueReporting - commissionRemitted
        ),
      };
    });
}

// ------------------------------------------------------------------
// Claims Awaiting Payment (Quarterly)
// Rollover: unsettled claims carry forward each quarter until settled.
// ------------------------------------------------------------------
export function buildClaimsAwaitingRows(claims: ClaimSource[], period: ReturnPeriod): ReturnRow[] {
  return claims
    .filter((c) => {
      const notified = c.date_notified_to_insurer;
      if (!notified || notified > period.end) return false;
      const inThisQuarter = inPeriod(notified, period);
      const unsettled = !c.date_payment || c.date_payment.trim() === "";
      return inThisQuarter || unsettled;
    })
    .sort((a, b) => {
      const da = a.date_notified_to_insurer ?? "9999-12-31";
      const db = b.date_notified_to_insurer ?? "9999-12-31";
      return da.localeCompare(db);
    })
    .map((c, i) => ({
      sn: i + 1,
      date_notified_by_insured: c.date_notified_by_insured ?? "",
      date_notified_to_insurer: c.date_notified_to_insurer ?? "",
      insurer_name: text(c.insurer_name),
      claim_no: text(c.claim_no),
      claim_amount: num(c.claim_amount),
      date_discharge_voucher: c.date_discharge_voucher ?? "",
      insured_beneficiary: text(c.insured_beneficiary),
      date_payment: c.date_payment ?? "",
    }));
}

// ------------------------------------------------------------------
// Business Schedule and Premium Transmission (Quarterly)
// ------------------------------------------------------------------
export function buildBizScheduleRows(policies: PolicySource[], period: ReturnPeriod): ReturnRow[] {
  return policies
    .filter((p) => inPeriod(p.transaction_date, period))
    .sort(sortByDate)
    .map((p, i) => {
      const isUsd = p.currency === "USD";
      const premiumLocal = isUsd ? 0 : num(p.premium_collected);
      const premiumForeign = isUsd ? num(p.premium_collected) : 0;
      const commLocal = isUsd ? 0 : num(p.brokerage_commission);
      const commForeign = isUsd ? num(p.brokerage_commission) : 0;

      return {
        sn: i + 1,
        insured_name: text(p.insured_name ?? p.client_name),
        insurer_name: text(p.insurer_name),
        policy_no: text(p.policy_number),
        policy_detail: text(p.class_of_business ?? p.risk_type),
        commencement_of_risk: p.cover_from,
        sum_insured: num(p.sum_insured),
        premium_local: premiumLocal,
        premium_foreign: premiumForeign,
        date_received: p.premium_collection_date,
        date_transmitted: p.premium_payment_date,
        commission_local: commLocal,
        commission_foreign: commForeign,
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
    case "NEW_POLICIES":
      return buildNewPoliciesRows(data.policies, period);
    case "RENEWAL_POLICIES":
      return buildRenewalPoliciesRows(data.policies, period);
    case "FORM_7_2B":
      return buildForm72BRows(data.policies, period);
    case "FORM_7_2C":
      return buildForm72CRows(data.policies, period);
    case "CLAIMS_AWAITING":
      return buildClaimsAwaitingRows(data.claims ?? [], period);
    case "BIZ_SCHEDULE":
      return buildBizScheduleRows(data.policies, period);
    default:
      throw new Error(`Unknown return code: ${code}`);
  }
}
