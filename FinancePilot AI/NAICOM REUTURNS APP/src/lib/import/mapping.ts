export type ImportFieldType = "text" | "money" | "number" | "date" | "percent";

export interface ImportFieldMeta {
  key: string;
  label: string;
  type: ImportFieldType;
}

/** Target fields the import wizard can map Excel columns onto. */
export const POLICY_FIELDS: ImportFieldMeta[] = [
  { key: "policy_number", label: "Policy number", type: "text" },
  { key: "endorsement_number", label: "Endorsement number", type: "text" },
  { key: "transaction_type", label: "Transaction type", type: "text" },
  { key: "insured_name", label: "Insured / assured", type: "text" },
  { key: "client_name", label: "Client name", type: "text" },
  { key: "insurer_name", label: "Insurer name", type: "text" },
  { key: "broker_or_agent", label: "Broker / agent", type: "text" },
  { key: "ledger_account", label: "Ledger account", type: "text" },
  { key: "risk_type", label: "Risk type", type: "text" },
  { key: "class_of_business", label: "Class of business", type: "text" },
  { key: "transaction_date", label: "Transaction date", type: "date" },
  { key: "cover_from", label: "Cover from", type: "date" },
  { key: "cover_to", label: "Cover to", type: "date" },
  { key: "premium_collection_date", label: "Date of collection", type: "date" },
  { key: "premium_payment_date", label: "Date premium paid", type: "date" },
  { key: "sum_insured", label: "Sum insured", type: "money" },
  { key: "gross_premium", label: "Gross premium", type: "money" },
  { key: "premium_collected", label: "Premium collected", type: "money" },
  { key: "premium_paid_to_insurer", label: "Premium paid to insurer", type: "money" },
  { key: "brokerage_commission", label: "Brokerage commission", type: "money" },
  { key: "commission_rate", label: "Commission rate (%)", type: "percent" },
  { key: "tax", label: "Tax / WHT", type: "money" },
  { key: "other_deductions", label: "Other deductions", type: "money" },
  { key: "net_premium", label: "Net premium", type: "money" },
  { key: "amount_received", label: "Amount received", type: "money" },
  { key: "receipt_number", label: "Receipt number", type: "text" },
  { key: "debit_note_number", label: "Debit note number", type: "text" },
  { key: "credit_note_number", label: "Credit note number", type: "text" },
  { key: "branch_location", label: "Branch / location", type: "text" },
  { key: "remarks", label: "Remarks", type: "text" },
];

export function normalizeHeader(header: string): string {
  return header
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const AUTO_MAP: Record<string, string> = {
  "S NO": "transaction_reference",
  "TRANS REF": "transaction_reference",
  "TRANSACTION REFERENCE": "transaction_reference",
  "TRANS REF NO": "transaction_reference",
  "POLICY NO": "policy_number",
  "POLICY": "policy_number",
  "POLICY NUMBER": "policy_number",
  "ENDORSEMENT": "endorsement_number",
  "ENDORSEMENT NO": "endorsement_number",
  "TRANS TYPE": "transaction_type",
  "TRANSACTION TYPE": "transaction_type",
  "NEW OR RENEWAL": "transaction_type",
  "NAME OF ASSURED": "insured_name",
  "ASSURED": "insured_name",
  "INSURED": "insured_name",
  "INSURED NAME": "insured_name",
  "NAME OF INSURED": "insured_name",
  "CLIENT": "client_name",
  "CLIENT NAME": "client_name",
  "NAME OF CLIENT": "client_name",
  "CUSTOMER": "client_name",
  "CUSTOMER NAME": "client_name",
  "NAME OF CUSTOMER": "client_name",
  "INSURER": "insurer_name",
  "INSURER NAME": "insurer_name",
  "NAME OF INSURER": "insurer_name",
  "NAME OF INSURERS": "insurer_name",
  "INSURERS": "insurer_name",
  "BROKER AGENT": "broker_or_agent",
  "BROKERS AGENT": "broker_or_agent",
  "BROKER": "broker_or_agent",
  "BROKERS": "broker_or_agent",
  "AGENT": "broker_or_agent",
  "NAME OF BROKER AGENT": "broker_or_agent",
  "LEDGER ACC": "ledger_account",
  "LEDGER ACCOUNT": "ledger_account",
  "LEDGER ACCOUNT NO": "ledger_account",
  "LEDGER ACC NO": "ledger_account",
  "RISK TYPE": "risk_type",
  "RISK CLASS": "risk_type",
  "CLASS OF BUSINESS": "class_of_business",
  "BUSINESS CLASS": "class_of_business",
  "TRANSACTION DATE": "transaction_date",
  "DATE": "transaction_date",
  "DATE OF POLICY": "transaction_date",
  "POLICY DATE": "transaction_date",
  "DATE OF TRANSACTION": "transaction_date",
  "PERIOD COVER FROM": "cover_from",
  "FROM DATE": "cover_from",
  "COVER FROM": "cover_from",
  "PERIOD FROM": "cover_from",
  "PERIOD COVER TO": "cover_to",
  "TO DATE": "cover_to",
  "COVER TO": "cover_to",
  "PERIOD TO": "cover_to",
  "DATE OF RECEIPT": "premium_collection_date",
  "DATE OF RECEIPT OF PREMIUM": "premium_collection_date",
  "DATE COLLECTED": "premium_collection_date",
  "DATE OF COLLECTION": "premium_collection_date",
  "COLLECTION DATE": "premium_collection_date",
  "DATE OF PREMIUM PAID": "premium_payment_date",
  "DATE PREMIUM PAID": "premium_payment_date",
  "DATE REMITTED": "premium_payment_date",
  "DATE REMITTED TRANSFERRED": "premium_payment_date",
  "PREMIUM PAYMENT DATE": "premium_payment_date",
  "SUM INSURED": "sum_insured",
  "GROSS PREMIUM": "gross_premium",
  "PREMIUM": "gross_premium",
  "PREMIUM NGN": "gross_premium",
  "PREMIUM USD": "gross_premium",
  "GROSS PREMIUM NGN": "gross_premium",
  "GROSS PREMIUM NAIRA": "gross_premium",
  "GROSS PREMIUM USD": "gross_premium",
  "GROSS PREMIUM DOLLAR": "gross_premium",
  "PREMIUM COLLECTED": "premium_collected",
  "PREMIUM COLLECTED NGN": "premium_collected",
  "PREMIUM COLLECTED NAIRA": "premium_collected",
  "PREMIUM COLLECTED USD": "premium_collected",
  "PREMIUM COLLECTED DOLLAR": "premium_collected",
  "PREMIUM PAID": "premium_paid_to_insurer",
  "PREMIUM PAID TO INSURER": "premium_paid_to_insurer",
  "PREMIUM PAID NGN": "premium_paid_to_insurer",
  "PREMIUM PAID NAIRA": "premium_paid_to_insurer",
  "PREMIUM PAID USD": "premium_paid_to_insurer",
  "PREMIUM PAID DOLLAR": "premium_paid_to_insurer",
  "AMOUNT REMITTED": "premium_paid_to_insurer",
  "AMOUNT REMITTED TRANSFERRED": "premium_paid_to_insurer",
  "BROKERAGE": "brokerage_commission",
  "BROKERAGE COMMISSION": "brokerage_commission",
  "COMMISSION": "brokerage_commission",
  "BROKERAGE COMMISSION NGN": "brokerage_commission",
  "BROKERAGE COMMISSION NAIRA": "brokerage_commission",
  "BROKERAGE COMMISSION USD": "brokerage_commission",
  "BROKERAGE COMMISSION DOLLAR": "brokerage_commission",
  "APPROVED RATE": "commission_rate",
  "APPROVED COMMISSION RATE": "commission_rate",
  "COMMISSION RATE": "commission_rate",
  "NET RATE": "commission_rate",
  "NET COMMISSION RATE": "commission_rate",
  "TAX": "tax",
  "TAX PAID": "tax",
  "WHT": "tax",
  "WITHHOLDING TAX": "tax",
  "OTHER DEDUCTION": "other_deductions",
  "OTHER DEDUCTIONS": "other_deductions",
  "NET PREMIUM": "net_premium",
  "NET PREM": "net_premium",
  "AMOUNT RECEIVED": "amount_received",
  "RECEIPT NO": "receipt_number",
  "RECEIPT NUMBER": "receipt_number",
  "DEBIT NOTE": "debit_note_number",
  "DEBIT NOTE NO": "debit_note_number",
  "CREDIT NOTE": "credit_note_number",
  "CREDIT NOTE NO": "credit_note_number",
  "CREDIT NOTE DATE": "credit_note_number",
  "BRANCH": "branch_location",
  "BRANCH LOCATION": "branch_location",
  "LOCATION": "branch_location",
  "ORIGINATING LOCATION OR BRANCH": "branch_location",
  "REMARKS": "remarks",
  "NOTE": "remarks",
};

export function autoMapColumn(header: string): string | null {
  const normalized = normalizeHeader(header);
  return AUTO_MAP[normalized] ?? null;
}

export interface ColumnMapping {
  index: number;
  sourceHeader: string;
  targetKey: string | null;
}

export function autoMapColumns(headers: string[]): ColumnMapping[] {
  return headers.map((header, index) => ({
    index,
    sourceHeader: header,
    targetKey: autoMapColumn(header),
  }));
}

/** Picks the sheet row whose text maps best to policy fields (workbooks carry a title block). */
export function detectHeaderRow(rows: (readonly (string | number | null)[])[], maxScan = 15): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const score = rows[i].filter((c) => c !== null && autoMapColumn(String(c)) !== null).length;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

const CURRENCY_HEADER = /USD|\$\s*|\sUSD\b|US\$|DOLLAR/i;
const NGN_HEADER = /NGN|₦|NAIRA/i;

export function detectCurrency(header: string): "NGN" | "USD" | null {
  if (CURRENCY_HEADER.test(header)) return "USD";
  if (NGN_HEADER.test(header)) return "NGN";
  return null;
}

export function fieldMeta(key: string): ImportFieldMeta | undefined {
  return POLICY_FIELDS.find((f) => f.key === key);
}
