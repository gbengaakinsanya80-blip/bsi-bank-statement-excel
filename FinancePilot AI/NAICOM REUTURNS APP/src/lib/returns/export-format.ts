export interface ExportFormat {
  title: string;
  form?: string;
  occurrence?: string;
  totals?: string[];
  sheets?: string[];
  numberFormat?: string;
}

export const EXPORT_FORMATS: Record<string, ExportFormat> = {
  INCOME_PRODUCTION: {
    title: "INCOME PRODUCTION",
    totals: ["sum_insured", "gross_premium", "brokerage", "net_premium", "amount_received"],
    numberFormat: "en-NG",
  },
  PPS: {
    title: "PREMIUM INCOME/PRODUCTION SCHEDULE (PPS-A)",
    form: "PPS-A",
    occurrence: "Monthly",
    totals: ["sum_insured", "gross_premium", "brokerage", "net_premium", "amount_received"],
    numberFormat: "en-NG",
  },
  CRR: {
    title: "COMMISSION AND REBATE RETURNS (CRR)",
    totals: [
      "sum_insured",
      "gross_premium",
      "tax_paid",
      "brokerage_commission",
      "other_deduction",
      "net_premium",
      "amount_received",
    ],
    numberFormat: "en-NG",
  },
  BUSINESSES_GENERATED: {
    title: "SCHEDULE OF BUSINESSES GENERATED",
    totals: ["gp_ngn", "gp_usd", "pc_ngn", "pc_usd", "pp_ngn", "pp_usd", "comm_ngn", "comm_usd"],
    numberFormat: "en-NG",
  },
  PERSONNEL: {
    title: "PERSONNEL RETURNS",
    sheets: ["FIRST SCHEDULE", "SECOND SCHEDULE"],
    numberFormat: "en-NG",
  },
  FORM_1C: {
    title: "NAICOM FORM 1C",
    totals: ["gross_premium", "collected", "paid", "commission"],
    numberFormat: "en-NG",
  },
  BROKERAGE_COMMISSION: {
    title: "RETURNS - INSURANCE BROKERAGE COMMISSION REGISTER",
    occurrence: "Annually",
    totals: ["sum_insured", "gross_premium", "commission_earned", "withholding_tax", "net_commission"],
    numberFormat: "en-NG",
  },
  NEW_POLICIES: {
    title: "ALL NEW POLICIES",
    occurrence: "Monthly",
    totals: ["sum_insured", "gross_premium", "premium_collected", "premium_paid_to_insurer", "brokerage_commission", "tax", "net_premium"],
    numberFormat: "en-NG",
  },
  RENEWAL_POLICIES: {
    title: "ALL RENEWAL POLICIES",
    occurrence: "Monthly",
    totals: ["sum_insured", "gross_premium", "premium_collected", "premium_paid_to_insurer", "brokerage_commission", "tax", "net_premium"],
    numberFormat: "en-NG",
  },
  FORM_7_2B: {
    title: "FORM 7.2B — STATEMENT OF BUSINESS GENERATED IN THE HALF YEAR",
    form: "FORM 7.2B",
    occurrence: "Half-Yearly",
    totals: [
      "sum_insured",
      "total_gross_premium",
      "net_premium",
      "premium_received_by_broker",
      "total_commission_fee",
      "commission_due_to_cobrokers",
      "commission_due_to_reporting",
      "commission_income_earned",
      "deferred_commission",
    ],
    numberFormat: "en-NG",
  },
  FORM_7_2C: {
    title: "FORM 7.2C — SCHEDULE OF REMITTANCES IN RESPECT OF BUSINESS GENERATED IN THE HALF YEAR",
    form: "FORM 7.2C",
    occurrence: "Half-Yearly",
    totals: [
      "total_received",
      "premium_due_to_insurers",
      "commission_due_reporting",
      "premium_remitted",
      "commission_remitted",
      "outstanding_premium",
      "outstanding_commission",
    ],
    numberFormat: "en-NG",
  },
  CLAIMS_AWAITING: {
    title: "SCHEDULE OF CLAIMS AWAITING PAYMENT",
    occurrence: "Quarterly",
    totals: ["claim_amount"],
    numberFormat: "en-NG",
  },
  BIZ_SCHEDULE: {
    title: "BUSINESS SCHEDULE AND PREMIUM TRANSMISSION",
    occurrence: "Quarterly",
    totals: ["sum_insured", "premium_local", "premium_foreign", "commission_local", "commission_foreign"],
    numberFormat: "en-NG",
  },
};

export function getExportFormat(code: string): ExportFormat {
  return EXPORT_FORMATS[code] ?? { title: code };
}
