import type { DbClient } from "@/lib/supabase/server";
import { demoClients, demoInsurers, demoPolicies, demoStaff } from "@/lib/demo/data";
import { listDemoReturns } from "@/lib/returns/demo-store";
import { getReturnDefinition } from "@/lib/returns/definitions";

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export interface SearchResults {
  clients: SearchResultItem[];
  policies: SearchResultItem[];
  insurers: SearchResultItem[];
  staff: SearchResultItem[];
  returns: SearchResultItem[];
}

const ilike = (v: string | null | undefined, q: string): boolean =>
  (v ?? "").toLowerCase().includes(q);

function empty(): SearchResults {
  return { clients: [], policies: [], insurers: [], staff: [], returns: [] };
}

export async function searchAll(
  supabase: DbClient | null,
  query: string
): Promise<SearchResults> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return empty();

  if (!supabase) {
    const demoReturns = await listDemoReturns();
    return {
      clients: demoClients
        .filter((c) => ilike(c.client_name, q) || ilike(c.contact_person, q))
        .slice(0, 10)
        .map((c) => ({
          id: c.id,
          title: c.client_name,
          subtitle: `Client · ${c.industry ?? "—"}`,
          href: "/clients",
        })),
      policies: demoPolicies
        .filter(
          (p) =>
            ilike(p.policy_number, q) ||
            ilike(p.insured_name, q) ||
            ilike(p.transaction_reference, q) ||
            ilike(p.receipt_number, q)
        )
        .slice(0, 10)
        .map((p) => ({
          id: p.id,
          title: p.policy_number ?? "Policy",
          subtitle: `${p.insured_name ?? "—"} · ${p.risk_type ?? "—"}`,
          href: "/policies",
        })),
      insurers: demoInsurers
        .filter((i) => ilike(i.insurer_name, q) || ilike(i.naicom_code, q))
        .slice(0, 10)
        .map((i) => ({
          id: i.id,
          title: i.insurer_name,
          subtitle: `Insurer · ${i.naicom_code ?? "—"}`,
          href: "/insurers",
        })),
      staff: demoStaff
        .filter((s) => ilike(s.staff_name, q) || ilike(s.designation, q))
        .slice(0, 10)
        .map((s) => ({
          id: s.id,
          title: s.staff_name,
          subtitle: `Staff · ${s.designation ?? "—"}`,
          href: "/staff",
        })),
      returns: demoReturns
        .filter((r) => ilike(getReturnDefinition(r.code).name, q) || ilike(r.period.label, q))
        .slice(0, 10)
        .map((r) => ({
          id: r.id,
          title: getReturnDefinition(r.code).name,
          subtitle: `${r.period.label} · ${r.status}`,
          href: `/returns/${r.id}`,
        })),
    };
  }

  const term = `%${query.trim()}%`;

  const [clients, policies, insurers, staff, returns] = await Promise.all([
    supabase
      .from("clients")
      .select("id, client_name, industry, contact_person")
      .ilike("client_name", term)
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("policies")
      .select("id, policy_number, insured_name, transaction_reference, receipt_number, risk_type")
      .or(
        `policy_number.ilike.${term},insured_name.ilike.${term},transaction_reference.ilike.${term},receipt_number.ilike.${term}`
      )
      .is("deleted_at", null)
      .eq("is_demo", false)
      .limit(10),
    supabase
      .from("insurers")
      .select("id, insurer_name, naicom_code")
      .or(`insurer_name.ilike.${term},naicom_code.ilike.${term}`)
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("staff")
      .select("id, staff_name, designation")
      .or(`staff_name.ilike.${term},designation.ilike.${term}`)
      .is("deleted_at", null)
      .limit(10),
    supabase
      .from("returns")
      .select("id, status, period_label, return_definitions(name, code)")
      .limit(200),
  ]);

  const lower = q;
  const returnItems = (returns?.data ?? [])
    .filter((r) => {
      const name = (r.return_definitions as unknown as { name?: string } | null)?.name ?? "";
      const code = (r.return_definitions as unknown as { code?: string } | null)?.code ?? "";
      return ilike(name, lower) || ilike(r.period_label, lower) || ilike(code, lower);
    })
    .slice(0, 10)
    .map((r) => ({
      id: r.id,
      title: (r.return_definitions as unknown as { name?: string } | null)?.name ?? "Return",
      subtitle: `${r.period_label} · ${r.status}`,
      href: `/returns/${r.id}`,
    }));

  return {
    clients: (clients.data ?? []).map((c) => ({
      id: c.id,
      title: c.client_name,
      subtitle: `Client · ${c.industry ?? "—"}`,
      href: "/clients",
    })),
    policies: (policies.data ?? []).map((p) => ({
      id: p.id,
      title: p.policy_number ?? "Policy",
      subtitle: `${p.insured_name ?? "—"} · ${p.risk_type ?? "—"}`,
      href: "/policies",
    })),
    insurers: (insurers.data ?? []).map((i) => ({
      id: i.id,
      title: i.insurer_name,
      subtitle: `Insurer · ${i.naicom_code ?? "—"}`,
      href: "/insurers",
    })),
    staff: (staff.data ?? []).map((s) => ({
      id: s.id,
      title: s.staff_name,
      subtitle: `Staff · ${s.designation ?? "—"}`,
      href: "/staff",
    })),
    returns: returnItems,
  };
}

export function resultGroups(): { key: keyof SearchResults; label: string }[] {
  return [
    { key: "policies", label: "Policies" },
    { key: "clients", label: "Clients" },
    { key: "insurers", label: "Insurers" },
    { key: "staff", label: "Staff" },
    { key: "returns", label: "Returns" },
  ];
}
