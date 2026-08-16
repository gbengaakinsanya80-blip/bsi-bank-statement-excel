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
};

export function getExportFormat(code: string): ExportFormat {
  return EXPORT_FORMATS[code] ?? { title: code };
}
