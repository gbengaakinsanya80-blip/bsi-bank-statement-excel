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
];

export function getReturnDefinition(code: string): ReturnDefinition {
  const def = RETURN_DEFINITIONS.find((d) => d.code === code);
  if (!def) throw new Error(`Unknown return code: ${code}`);
  return def;
}
