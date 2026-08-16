import type { PolicySource, ReturnRow } from "@/lib/returns/types";
import { formatMoney } from "@/lib/utils/format";

export interface ReconciliationRule {
  id: string;
  name: string;
  code: string;
  sourceA: string;
  sourceB: string;
  threshold: number;
}

export const RECONCILIATION_RULES: ReconciliationRule[] = [
  {
    id: "commission",
    name: "Commission consistency — CRR vs Income Production",
    code: "commission",
    sourceA: "CRR — sum of brokerage commission",
    sourceB: "Income Production — sum of brokerage",
    threshold: 0.01,
  },
  {
    id: "premium",
    name: "Premium consistency — Businesses Generated vs Income Production",
    code: "premium",
    sourceA: "Businesses Generated — gross premium (₦)",
    sourceB: "Income Production — gross premium",
    threshold: 0.01,
  },
  {
    id: "commission_register",
    name: "Commission register — Brokerage Commission Register vs CRR",
    code: "commission_register",
    sourceA: "Brokerage Commission Register — commission earned",
    sourceB: "CRR — brokerage commission",
    threshold: 0.01,
  },
  {
    id: "form1c",
    name: "Form 1C integrity — totals vs underlying policies",
    code: "form1c",
    sourceA: "Form 1C — gross premium",
    sourceB: "Underlying policies — gross premium",
    threshold: 0.01,
  },
  {
    id: "collection",
    name: "Collection sanity — policy collections vs policies",
    code: "collection",
    sourceA: "policy_collections — per-policy sums",
    sourceB: "policies — premium collected",
    threshold: 0.01,
  },
  {
    id: "remittance",
    name: "Remittance sanity — policy remittances vs policies",
    code: "remittance",
    sourceA: "policy_remittances — per-policy sums",
    sourceB: "policies — premium paid to insurer",
    threshold: 0.01,
  },
  {
    id: "rate",
    name: "Commission vs rate — policies vs commission rate × gross",
    code: "rate",
    sourceA: "policies — brokerage commission",
    sourceB: "policies — commission rate × gross premium",
    threshold: 1,
  },
];

export interface DrilldownRow {
  policyNo?: string | null;
  label: string;
  value: number;
}

export interface ReconcileResult {
  ruleId: string;
  name: string;
  code: string;
  status: "OK" | "WARNING" | "N/A";
  valueA: number | null;
  valueB: number | null;
  difference: number | null;
  message: string;
  linkA: string | null;
  linkB: string | null;
  drilldown: DrilldownRow[];
}

export interface ReconciliationReturnLike {
  id: string;
  code: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  rows: ReturnRow[];
}

export interface ReconciliationInput {
  returns: ReconciliationReturnLike[];
  policies: PolicySource[];
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function sumRows(rows: ReturnRow[], key: string): number {
  return round2(rows.reduce((sum, r) => sum + (Number(r[key]) || 0), 0));
}

function diffMessage(aName: string, a: number, bName: string, b: number): string {
  return `${aName} is ${formatMoney(a)} while ${bName} shows ${formatMoney(b)}. Difference: ${formatMoney(Math.abs(a - b))}.`;
}

export function runReconciliation(input: ReconciliationInput): ReconcileResult[] {
  const { returns, policies } = input;

  const crr = returns.filter((r) => r.code === "CRR");
  const ip = returns.filter((r) => r.code === "INCOME_PRODUCTION");
  const biz = returns.filter((r) => r.code === "BUSINESSES_GENERATED");
  const f1c = returns.filter((r) => r.code === "FORM_1C");
  const reg = returns.filter((r) => r.code === "BROKERAGE_COMMISSION");

  const results: ReconcileResult[] = [];

  results.push(reconcilePair(
    "commission",
    "Commission consistency — CRR vs Income Production",
    "CRR",
    "Income Production",
    sumRows(crr.flatMap((r) => r.rows), "brokerage_commission"),
    sumRows(ip.flatMap((r) => r.rows), "brokerage"),
    crr.length === 0 || ip.length === 0,
    "Generate both the CRR and Income Production returns to compare brokerage commission.",
    crr.map((r) => ({
      id: r.id,
      periodKey: r.periodKey,
      drilldown: r.rows.map((row) => ({
        policyNo: row.policy_no as string | null,
        label: `CRR — ${r.periodKey} — ${(row.client as string) ?? (row.policy_no as string) ?? "row"}`,
        value: Number(row.brokerage_commission) || 0,
      })),
    })),
    ip.map((r) => ({
      id: r.id,
      periodKey: r.periodKey,
      drilldown: r.rows.map((row) => ({
        policyNo: row.policy_no as string | null,
        label: `Income Production — ${r.periodKey} — ${(row.assured as string) ?? (row.policy_no as string) ?? "row"}`,
        value: Number(row.brokerage) || 0,
      })),
    }))
  ));

  results.push(reconcilePair(
    "commission_register",
    "Commission register — Brokerage Commission Register vs CRR",
    "Brokerage Commission Register",
    "CRR",
    sumRows(reg.flatMap((r) => r.rows), "commission_earned"),
    sumRows(crr.flatMap((r) => r.rows), "brokerage_commission"),
    reg.length === 0 || crr.length === 0,
    "Generate both the Brokerage Commission Register and the CRR returns to compare commission earned.",
    reg.map((r) => ({
      id: r.id,
      periodKey: r.periodKey,
      drilldown: r.rows.map((row) => ({
        policyNo: row.policy_no as string | null,
        label: `Brokerage Commission Register — ${r.periodKey} — ${(row.client as string) ?? (row.policy_no as string) ?? "row"}`,
        value: Number(row.commission_earned) || 0,
      })),
    })),
    crr.map((r) => ({
      id: r.id,
      periodKey: r.periodKey,
      drilldown: r.rows.map((row) => ({
        policyNo: row.policy_no as string | null,
        label: `CRR — ${r.periodKey} — ${(row.client as string) ?? (row.policy_no as string) ?? "row"}`,
        value: Number(row.brokerage_commission) || 0,
      })),
    }))
  ));

  results.push(reconcilePair(
    "premium",
    "Premium consistency — Businesses Generated vs Income Production",
    "Businesses Generated",
    "Income Production",
    sumRows(biz.flatMap((r) => r.rows), "gp_ngn"),
    sumRows(ip.flatMap((r) => r.rows), "gross_premium"),
    biz.length === 0 || ip.length === 0,
    "Generate both the Businesses Generated and Income Production returns to compare gross premium.",
    biz.map((r) => ({
      id: r.id,
      periodKey: r.periodKey,
      drilldown: r.rows.map((row) => ({
        policyNo: row.policy_no as string | null,
        label: `Businesses Generated — ${r.periodKey} — ${(row.insured as string) ?? "row"}`,
        value: Number(row.gp_ngn) || 0,
      })),
    })),
    ip.map((r) => ({
      id: r.id,
      periodKey: r.periodKey,
      drilldown: r.rows.map((row) => ({
        policyNo: row.policy_no as string | null,
        label: `Income Production — ${r.periodKey} — ${(row.assured as string) ?? (row.policy_no as string) ?? "row"}`,
        value: Number(row.gross_premium) || 0,
      })),
    }))
  ));

  const f1cRows = f1c.flatMap((r) => r.rows);
  const f1cPeriod = f1c[0];
  const periodPolicies = f1cPeriod
    ? policies.filter(
        (p) =>
          p.transaction_date &&
          p.transaction_date >= f1cPeriod.periodStart &&
          p.transaction_date <= f1cPeriod.periodEnd
      )
    : [];
  results.push(reconcilePair(
    "form1c",
    "Form 1C integrity — totals vs underlying policies",
    "Form 1C",
    "Underlying policies",
    sumRows(f1cRows, "gross_premium"),
    round2(periodPolicies.reduce((s, p) => s + (Number(p.gross_premium) || 0), 0)),
    f1c.length === 0,
    "Generate the Form 1C return to reconcile it against the underlying policies in its period.",
    f1c.map((r) => ({
      id: r.id,
      periodKey: r.periodKey,
      drilldown: r.rows.map((row) => ({
        label: `Form 1C — ${(row.insurer as string) ?? "insurer"}`,
        value: Number(row.gross_premium) || 0,
      })),
    })),
    [
      {
        id: null,
        periodKey: f1cPeriod?.periodKey ?? "",
        drilldown: periodPolicies.map((p) => ({
          policyNo: p.policy_number,
          label: `Policy ${p.policy_number ?? "—"} — ${p.insured_name ?? "insured"}`,
          value: Number(p.gross_premium) || 0,
        })),
      },
    ]
  ));

  results.push({
    ruleId: "collection",
    name: "Collection sanity — policy collections vs policies",
    code: "collection",
    status: "N/A",
    valueA: null,
    valueB: null,
    difference: null,
    message:
      "Not applicable in preview: the demo dataset does not include policy_collections records.",
    linkA: null,
    linkB: null,
    drilldown: [],
  });

  results.push({
    ruleId: "remittance",
    name: "Remittance sanity — policy remittances vs policies",
    code: "remittance",
    status: "N/A",
    valueA: null,
    valueB: null,
    difference: null,
    message:
      "Not applicable in preview: the demo dataset does not include policy_remittances records.",
    linkA: null,
    linkB: null,
    drilldown: [],
  });

  const storedCommission = round2(policies.reduce((s, p) => s + (Number(p.brokerage_commission) || 0), 0));
  const expectedCommission = round2(
    policies.reduce((s, p) => s + ((Number(p.gross_premium) || 0) * (Number(p.commission_rate) || 0)) / 100, 0)
  );
  const mismatched = policies
    .map((p) => {
      const gross = Number(p.gross_premium) || 0;
      const rate = Number(p.commission_rate) || 0;
      const stored = Number(p.brokerage_commission) || 0;
      const expected = (gross * rate) / 100;
      const tolerance = Math.max(1, Math.abs(gross) * 0.01);
      return { p, expected, stored, mismatch: Math.abs(stored - expected) > tolerance };
    })
    .filter((m) => m.mismatch);
  const commissionDiff = round2(storedCommission - expectedCommission);
  results.push({
    ruleId: "rate",
    name: "Commission vs rate — policies vs commission rate × gross",
    code: "rate",
    status: mismatched.length === 0 ? "OK" : "WARNING",
    valueA: storedCommission,
    valueB: expectedCommission,
    difference: Math.abs(commissionDiff),
    message:
      mismatched.length === 0
        ? `Brokerage commission reconciles to commission rate × gross premium on all policies.`
        : `${mismatched.length} polic${mismatched.length === 1 ? "y" : "ies"} store commission inconsistent with the approved rate. ${diffMessage("Stored brokerage commission", storedCommission, "commission rate × gross premium", expectedCommission)}`,
    linkA: null,
    linkB: null,
    drilldown: mismatched.map((m) => ({
      policyNo: m.p.policy_number,
      label: `Policy ${m.p.policy_number ?? "—"} — ${m.p.insured_name ?? "insured"}: stored ${formatMoney(m.stored)}, expected ${formatMoney(m.expected)}`,
      value: round2(m.stored - m.expected),
    })),
  });

  return results;
}

interface SideGroup {
  id: string | null;
  periodKey: string;
  drilldown: DrilldownRow[];
}

function reconcilePair(
  ruleId: string,
  name: string,
  aName: string,
  bName: string,
  valueA: number,
  valueB: number,
  notApplicable: boolean,
  naMessage: string,
  groupsA: SideGroup[],
  groupsB: SideGroup[]
): ReconcileResult {
  if (notApplicable) {
    return {
      ruleId,
      name,
      code: ruleId,
      status: "N/A",
      valueA: null,
      valueB: null,
      difference: null,
      message: naMessage,
      linkA: groupsA[0]?.id ?? null,
      linkB: groupsB[0]?.id ?? null,
      drilldown: [],
    };
  }

  const difference = Math.abs(round2(valueA - valueB));
  const ok = difference <= RECONCILIATION_RULES.find((r) => r.id === ruleId)!.threshold;

  return {
    ruleId,
    name,
    code: ruleId,
    status: ok ? "OK" : "WARNING",
    valueA,
    valueB,
    difference,
    message: ok
      ? `${aName} reconciles with ${bName} (${formatMoney(valueA)} = ${formatMoney(valueB)}).`
      : diffMessage(
          `${aName} ${ruleId === "commission" ? "brokerage commission" : ruleId === "commission_register" ? "commission earned" : ruleId === "form1c" ? "gross premium" : "gross premium"}`,
          valueA,
          bName,
          valueB
        ),
    linkA: groupsA[0]?.id ?? null,
    linkB: groupsB[0]?.id ?? null,
    drilldown: [...groupsA.flatMap((g) => g.drilldown), ...groupsB.flatMap((g) => g.drilldown)],
  };
}
