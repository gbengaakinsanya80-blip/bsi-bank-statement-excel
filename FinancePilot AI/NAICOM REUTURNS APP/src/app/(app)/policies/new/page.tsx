import type { Metadata } from "next";
import { PolicyForm } from "@/components/policies/policy-form";
import { createServerSupabase } from "@/lib/supabase/server";
import { listClients } from "@/lib/services/client-service";
import { listInsurers } from "@/lib/services/insurer-service";
import { listCurrencies, listRiskClasses } from "@/lib/services/master-data-service";
import { listDemoClients, listDemoInsurers } from "@/lib/demo/master-store";
import { demoCurrencies, demoRiskClasses } from "@/lib/demo/data";

export const metadata: Metadata = { title: "New policy" };

export default async function NewPolicyPage() {
  const supabase = await createServerSupabase();
  const demo = !supabase;

  const [clients, insurers, riskClasses, currencies] = demo
    ? [await listDemoClients(), await listDemoInsurers(), demoRiskClasses, demoCurrencies]
    : await Promise.all([
        listClients(supabase),
        listInsurers(supabase),
        listRiskClasses(supabase),
        listCurrencies(supabase),
      ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New policy</h1>
        <p className="text-sm text-muted-foreground">
          One entry feeds Income Production, CRR, Businesses Generated, Form 1C and premium reports.
        </p>
      </div>
      <PolicyForm
        clients={clients}
        insurers={insurers}
        riskClasses={riskClasses}
        currencies={currencies}
        demo={demo}
      />
    </div>
  );
}
