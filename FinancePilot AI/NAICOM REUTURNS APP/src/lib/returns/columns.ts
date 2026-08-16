import type { ReturnRow, ReturnTotal } from "@/lib/returns/types";

export interface ReturnColumn {
  key: string;
  header: string;
  type: "text" | "money" | "number" | "date" | "percent";
  currency?: string;
}

export const RETURN_COLUMNS: Record<string, ReturnColumn[]> = {
  INCOME_PRODUCTION: [
    { key: "sn", header: "S/N", type: "number" },
    { key: "date", header: "Date", type: "date" },
    { key: "trans_ref", header: "Trans. Ref.", type: "text" },
    { key: "policy_no", header: "Policy No.", type: "text" },
    { key: "endorsement", header: "Endorsement", type: "text" },
    { key: "trans_type", header: "Trans. Type", type: "text" },
    { key: "cover_from", header: "Cover From", type: "date" },
    { key: "cover_to", header: "Cover To", type: "date" },
    { key: "assured", header: "Assured", type: "text" },
    { key: "customer", header: "Customer", type: "text" },
    { key: "broker", header: "Broker/Agent", type: "text" },
    { key: "ledger_acc", header: "Ledger Acc.", type: "text" },
    { key: "sum_insured", header: "Sum Insured", type: "money" },
    { key: "gross_premium", header: "Gross Premium", type: "money" },
    { key: "brokerage", header: "Brokerage", type: "money" },
    { key: "net_premium", header: "Net Premium", type: "money" },
    { key: "tenor", header: "Tenor (days)", type: "number" },
    { key: "end_date", header: "End Date", type: "date" },
    { key: "debit_note", header: "Debit Note", type: "text" },
    { key: "credit_note", header: "Credit Note", type: "text" },
    { key: "amount_received", header: "Amount Received", type: "money" },
    { key: "date_receipt", header: "Date of Receipt", type: "date" },
    { key: "receipt_no", header: "Receipt No.", type: "text" },
    { key: "bank", header: "Bank of Lodgement", type: "text" },
    { key: "date_lodgement", header: "Date of Lodgement", type: "date" },
    { key: "remarks", header: "Remarks", type: "text" },
  ],
  PPS: [
    { key: "sn", header: "S/No", type: "number" },
    { key: "policy_no", header: "Policy No", type: "text" },
    { key: "endorsement", header: "Endorsement No", type: "text" },
    { key: "trans_type", header: "Transaction Type", type: "text" },
    { key: "cover_from", header: "From Date", type: "date" },
    { key: "cover_to", header: "To Date", type: "date" },
    { key: "assured", header: "Assured", type: "text" },
    { key: "customer", header: "Customer Name", type: "text" },
    { key: "broker", header: "Broker/Agent", type: "text" },
    { key: "sum_insured", header: "Sum Insured", type: "money" },
    { key: "gross_premium", header: "Premium", type: "money" },
    { key: "brokerage", header: "Brokerage", type: "money" },
    { key: "net_premium", header: "Net Prem", type: "money" },
    { key: "tenor", header: "Tenor (Days)", type: "number" },
    { key: "debit_note", header: "Debit Note", type: "text" },
    { key: "credit_note", header: "Credit Note No", type: "text" },
    { key: "amount_received", header: "Amount Received", type: "money" },
    { key: "date_receipt", header: "Date of Receipt", type: "date" },
    { key: "receipt_no", header: "Receipt No", type: "text" },
    { key: "bank", header: "Bank of Lodgement", type: "text" },
    { key: "date_lodgement", header: "Date of Lodgement", type: "date" },
    { key: "insurer", header: "Name of Insurer(s)", type: "text" },
    { key: "remittance", header: "Amount Remitted", type: "money" },
    { key: "unremitted", header: "Amount Unremitted", type: "money" },
    { key: "remittance_date", header: "Date Remitted", type: "date" },
    { key: "branch", header: "Branch", type: "text" },
    { key: "remarks", header: "Remarks", type: "text" },
  ],
  CRR: [
    { key: "sn", header: "S/N", type: "number" },
    { key: "date", header: "Date", type: "date" },
    { key: "policy_no", header: "Policy No.", type: "text" },
    { key: "risk_type", header: "Risk Type", type: "text" },
    { key: "client", header: "Name of Client", type: "text" },
    { key: "insurer", header: "Name of Insurer", type: "text" },
    { key: "sum_insured", header: "Sum Insured", type: "money" },
    { key: "gross_premium", header: "Gross Premium", type: "money" },
    { key: "approved_rate", header: "Approved Commission Rate", type: "percent" },
    { key: "tax_paid", header: "Tax Paid", type: "money" },
    { key: "net_rate", header: "Net Commission Rate", type: "percent" },
    { key: "brokerage_commission", header: "Brokerage Commission", type: "money" },
    { key: "other_deduction", header: "Other Deduction", type: "money" },
    { key: "net_premium", header: "Net Premium", type: "money" },
    { key: "amount_received", header: "Amount Received", type: "money" },
    { key: "receipt_no", header: "Receipt No.", type: "text" },
    { key: "remarks", header: "Remarks", type: "text" },
  ],
  BUSINESSES_GENERATED: [
    { key: "sn", header: "S/N", type: "number" },
    { key: "insured", header: "Insured", type: "text" },
    { key: "class_of_business", header: "Class of Business", type: "text" },
    { key: "insurer", header: "Insurer", type: "text" },
    { key: "gp_ngn", header: "Gross Premium (₦)", type: "money", currency: "NGN" },
    { key: "gp_usd", header: "Gross Premium ($)", type: "money", currency: "USD" },
    { key: "pc_ngn", header: "Premium Collected (₦)", type: "money", currency: "NGN" },
    { key: "pc_usd", header: "Premium Collected ($)", type: "money", currency: "USD" },
    { key: "date_collection", header: "Date of Collection", type: "date" },
    { key: "pp_ngn", header: "Premium Paid (₦)", type: "money", currency: "NGN" },
    { key: "pp_usd", header: "Premium Paid ($)", type: "money", currency: "USD" },
    { key: "date_paid", header: "Date of Premium Paid", type: "date" },
    { key: "comm_ngn", header: "Commission (₦)", type: "money", currency: "NGN" },
    { key: "comm_usd", header: "Commission ($)", type: "money", currency: "USD" },
  ],
  PERSONNEL_FIRST: [
    { key: "sn", header: "S/N", type: "number" },
    { key: "staff_name", header: "Name of Staff", type: "text" },
    { key: "staff_category", header: "Staff Category", type: "text" },
    { key: "designation", header: "Designation", type: "text" },
    { key: "gender", header: "Gender", type: "text" },
    { key: "educational_qualification", header: "Educational Qualification", type: "text" },
    { key: "professional_qualification", header: "Professional Qualification", type: "text" },
    { key: "date_of_employment", header: "Date of Employment", type: "date" },
    { key: "state_of_origin", header: "State of Origin", type: "text" },
    { key: "location", header: "Location", type: "text" },
    { key: "date_of_exit", header: "Date of Exit", type: "date" },
    { key: "reason_for_leaving", header: "Reasons for Leaving", type: "text" },
  ],
  PERSONNEL_SECOND: [
    { key: "category", header: "Category of Staff", type: "text" },
    { key: "previous", header: "Previous Number Total", type: "number" },
    { key: "entry", header: "Total Entry in Period", type: "number" },
    { key: "exit", header: "Total Exit in Period", type: "number" },
    { key: "current", header: "Current Number", type: "number" },
  ],
  FORM_1C: [
    { key: "item", header: "Item", type: "number" },
    { key: "insurer", header: "Insurer", type: "text" },
    { key: "gross_premium", header: "Gross Premium", type: "money" },
    { key: "collected", header: "Premium Collected", type: "money" },
    { key: "paid", header: "Premium Paid to Insurer", type: "money" },
    { key: "commission", header: "Commission", type: "money" },
  ],
  BROKERAGE_COMMISSION: [
    { key: "sn", header: "S/N", type: "number" },
    { key: "client", header: "Name of Client", type: "text" },
    { key: "insurer", header: "Name of Insurer", type: "text" },
    { key: "policy_no", header: "Policy No.", type: "text" },
    { key: "class_of_business", header: "Class of Business", type: "text" },
    { key: "date", header: "Date of Policy", type: "date" },
    { key: "sum_insured", header: "Sum Insured", type: "money" },
    { key: "gross_premium", header: "Gross Premium", type: "money" },
    { key: "commission_rate", header: "Commission Rate", type: "percent" },
    { key: "commission_earned", header: "Commission Earned", type: "money" },
    { key: "withholding_tax", header: "Withholding Tax (WHT)", type: "money" },
    { key: "net_commission", header: "Net Commission Received", type: "money" },
    { key: "date_received", header: "Date Commission Received", type: "date" },
    { key: "receipt_no", header: "Receipt No.", type: "text" },
    { key: "remarks", header: "Remarks", type: "text" },
  ],
};

const TOTAL_DEFS: Record<string, { label: string; key: string; currency?: string }[]> = {
  INCOME_PRODUCTION: [
    { label: "Sum insured", key: "sum_insured" },
    { label: "Gross premium", key: "gross_premium" },
    { label: "Brokerage", key: "brokerage" },
    { label: "Net premium", key: "net_premium" },
    { label: "Amount received", key: "amount_received" },
  ],
  PPS: [
    { label: "Sum insured", key: "sum_insured" },
    { label: "Premium", key: "gross_premium" },
    { label: "Brokerage", key: "brokerage" },
    { label: "Net prem", key: "net_premium" },
    { label: "Amount received", key: "amount_received" },
  ],
  CRR: [
    { label: "Sum insured", key: "sum_insured" },
    { label: "Gross premium", key: "gross_premium" },
    { label: "Tax paid", key: "tax_paid" },
    { label: "Brokerage commission", key: "brokerage_commission" },
    { label: "Other deduction", key: "other_deduction" },
    { label: "Net premium", key: "net_premium" },
    { label: "Amount received", key: "amount_received" },
  ],
  BUSINESSES_GENERATED: [
    { label: "Gross premium (₦)", key: "gp_ngn", currency: "NGN" },
    { label: "Gross premium ($)", key: "gp_usd", currency: "USD" },
    { label: "Premium collected (₦)", key: "pc_ngn", currency: "NGN" },
    { label: "Premium collected ($)", key: "pc_usd", currency: "USD" },
    { label: "Premium paid (₦)", key: "pp_ngn", currency: "NGN" },
    { label: "Premium paid ($)", key: "pp_usd", currency: "USD" },
    { label: "Commission (₦)", key: "comm_ngn", currency: "NGN" },
    { label: "Commission ($)", key: "comm_usd", currency: "USD" },
  ],
  FORM_1C: [
    { label: "Gross premium", key: "gross_premium" },
    { label: "Premium collected", key: "collected" },
    { label: "Premium paid to insurer", key: "paid" },
    { label: "Commission", key: "commission" },
  ],
  BROKERAGE_COMMISSION: [
    { label: "Sum insured", key: "sum_insured" },
    { label: "Gross premium", key: "gross_premium" },
    { label: "Commission earned", key: "commission_earned" },
    { label: "Withholding tax (WHT)", key: "withholding_tax" },
    { label: "Net commission received", key: "net_commission" },
  ],
};

export function computeReturnTotals(code: string, rows: ReturnRow[]): ReturnTotal[] {
  const defs = TOTAL_DEFS[code];
  if (!defs) return [];

  if (code === "PERSONNEL") {
    const firstCount = rows.filter((r) => r.schedule === "FIRST").length;
    const totalRow = rows.find((r) => r.schedule === "SECOND" && r.category === "TOTAL");
    const totals: ReturnTotal[] = [{ label: "Staff on roll in period", value: firstCount }];
    if (totalRow) {
      totals.push(
        { label: "Previous number", value: Number(totalRow.previous) },
        { label: "Total entry in period", value: Number(totalRow.entry) },
        { label: "Total exit in period", value: Number(totalRow.exit) },
        { label: "Current number", value: Number(totalRow.current) }
      );
    }
    return totals;
  }

  return defs.map((d) => ({
    label: d.label,
    value: round2(rows.reduce((sum, r) => sum + (Number(r[d.key]) || 0), 0)),
    currency: d.currency,
  }));
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
