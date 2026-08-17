export type ReturnFrequency = "MONTHLY" | "QUARTERLY" | "HALF_YEARLY" | "ANNUAL" | "AD_HOC";

export interface ReturnDefinition {
  code: string;
  name: string;
  formNumber: string | null;
  frequency: ReturnFrequency;
  department: string;
  description: string;
  source: string;
  requiresConfirmation: boolean;
}

export const RETURN_DEFINITIONS: ReturnDefinition[] = [
  {
    code: "INCOME_PRODUCTION",
    name: "Income Production",
    formNumber: null,
    frequency: "MONTHLY",
    department: "Operations / Finance",
    description:
      "Worldmark-branded monthly schedule of every policy written — one row per policy in the month.",
    source: "v_income_production",
    requiresConfirmation: false,
  },
  {
    code: "PPS",
    name: "Premium Income/Production Schedule (PPS-A)",
    formNumber: "PPS-A",
    frequency: "MONTHLY",
    department: "Finance",
    description:
      "NAICOM Form PPS-A submission layout — the same rows as Income Production in the NAICOM format.",
    source: "v_income_production",
    requiresConfirmation: false,
  },
  {
    code: "CRR",
    name: "Commission & Rebate Returns",
    formNumber: null,
    frequency: "QUARTERLY",
    department: "Finance",
    description:
      "Commission and rebate schedule — commission, net rates and net premium computed per policy.",
    source: "v_crr",
    requiresConfirmation: false,
  },
  {
    code: "BUSINESSES_GENERATED",
    name: "Schedule of Businesses Generated",
    formNumber: null,
    frequency: "HALF_YEARLY",
    department: "Operations",
    description:
      "Business generated during the half-year with Naira/Dollar splits resolved by policy currency.",
    source: "v_businesses_generated",
    requiresConfirmation: false,
  },
  {
    code: "PERSONNEL",
    name: "Personnel Returns",
    formNumber: null,
    frequency: "QUARTERLY",
    department: "HR",
    description:
      "Two schedules: statement of personnel on roll and the summary of changes during the quarter.",
    source: "staff",
    requiresConfirmation: false,
  },
  {
    code: "FORM_1C",
    name: "Form 1C",
    formNumber: "NAICOM Form 1C",
    frequency: "AD_HOC",
    department: "Finance",
    description:
      "Insurer-grouped premium summary as directed by NAICOM circular.",
    source: "v_form_1c",
    requiresConfirmation: true,
  },
  {
    code: "BROKERAGE_COMMISSION",
    name: "Returns - Insurance Brokerage Commission Register",
    formNumber: null,
    frequency: "ANNUAL",
    department: "Finance",
    description:
      "Annual register of brokerage commission earned from insurers during the year — one row per policy showing gross premium, commission rate, commission earned, withholding tax and net commission received, as required of registered insurance brokers under NAICOM returns guidelines.",
    source: "v_brokerage_commission",
    requiresConfirmation: false,
  },
  {
    code: "NEW_POLICIES",
    name: "All New Policies",
    formNumber: null,
    frequency: "MONTHLY",
    department: "Operations",
    description:
      "Monthly schedule of all new policies written — policy details, premiums, commissions and premium/renewal due dates. Can be generated for any month.",
    source: "policies",
    requiresConfirmation: false,
  },
  {
    code: "RENEWAL_POLICIES",
    name: "All Renewal Policies",
    formNumber: null,
    frequency: "MONTHLY",
    department: "Operations",
    description:
      "Monthly schedule of all renewed policies — policy details, premiums, commissions and premium/renewal due dates. Can be generated for any month.",
    source: "policies",
    requiresConfirmation: false,
  },
  {
    code: "FORM_7_2B",
    name: "Form 7.2B — Statement of Business Generated",
    formNumber: "FORM 7.2B",
    frequency: "HALF_YEARLY",
    department: "Operations / Finance",
    description:
      "Half-yearly statement of business generated (Form 7.2B) — one row per policy showing gross/net premium split into premium paid directly to insurers vs paid to the broker (local/foreign), premium received by the broker and commission income earned vs deferred.",
    source: "v_income_production",
    requiresConfirmation: false,
  },
  {
    code: "FORM_7_2C",
    name: "Form 7.2C — Schedule of Remittances",
    formNumber: "FORM 7.2C",
    frequency: "HALF_YEARLY",
    department: "Finance",
    description:
      "Half-yearly schedule of remittances (Form 7.2C) — one row per policy showing premium received, amounts due to each stakeholder (insurer, insured, FIRS/SIRS, co-brokers, reporting broker), amounts remitted and the outstanding balances.",
    source: "v_income_production",
    requiresConfirmation: false,
  },
  {
    code: "CLAIMS_AWAITING",
    name: "Schedule of Claims Awaiting Payment",
    formNumber: null,
    frequency: "QUARTERLY",
    department: "Operations",
    description:
      "Quarterly schedule of claims awaiting payment — claim notification dates, insurer, claim number, amount, discharge voucher status and payment date.",
    source: "policies",
    requiresConfirmation: false,
  },
  {
    code: "BIZ_SCHEDULE",
    name: "Business Schedule and Premium Transmission",
    formNumber: null,
    frequency: "QUARTERLY",
    department: "Operations / Finance",
    description:
      "Quarterly business schedule and premium transmission — policy details, premiums (local/foreign), premium receipt and transmission dates, commission (local/foreign).",
    source: "policies",
    requiresConfirmation: false,
  },
];

export function getReturnDefinition(code: string): ReturnDefinition {
  const def = RETURN_DEFINITIONS.find((d) => d.code === code);
  if (!def) throw new Error(`Unknown return code: ${code}`);
  return def;
}
