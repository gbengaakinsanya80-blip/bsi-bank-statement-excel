"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlans, subscribeToPlan } from "@/lib/api";
import { paystackCheckout } from "@/lib/paystack";
import type { BillingStatus, Plan } from "@/lib/types";

const FEATURES: Record<string, string[]> = {
  free: [
    "3 statements per month",
    "Excel / CSV / JSON export",
    "Validation & balance checks",
    "30-day search history",
  ],
  pro: [
    "Unlimited statements",
    "All export formats (incl. PDF & SQLite)",
    "Insights & account-head analysis",
    "Priority processing",
  ],
  business: [
    "Everything in Pro",
    "Batch processing",
    "Dedicated support",
    "Team-ready (more seats soon)",
  ],
};

export default function PricingPage() {
  return (
    <main className="container py-10">
      <div className="mx-auto max-w-3xl text-center">
        <Badge variant="secondary" className="mb-3 gap-1">
          <Sparkles className="h-3 w-3" /> Simple monthly pricing
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">Turn bank statements into Excel, without the mess</h1>
        <p className="mt-2 text-muted-foreground">
          Start free, upgrade when you need more. Billed monthly, cancel anytime.
        </p>
      </div>
      <PricingCards />
    </main>
  );
}

function PricingCards() {
  const { user } = useAuth();
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [publicKey, setPublicKey] = React.useState<string | null>(null);
  const [current, setCurrent] = React.useState<BillingStatus | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    getPlans()
      .then((res) => {
        setPlans(res.plans);
        setPublicKey(res.paystack_public_key);
      })
      .catch(() => setError("Could not load plans."));
    if (user) {
      import("@/lib/api").then(({ getBillingStatus }) =>
        getBillingStatus().then(setCurrent).catch(() => undefined),
      );
    }
  }, [user]);

  const startCheckout = async (plan: Plan) => {
    if (!user) {
      window.location.href = "/login?mode=register&next=/pricing";
      return;
    }
    setError(null);
    setSuccess(null);
    setBusy(plan.code);
    try {
      if (!publicKey) {
        throw new Error("Paystack is not configured. Set PAYSTACK_PUBLIC_KEY first.");
      }
      if (!plan.paystack_plan) {
        throw new Error("This plan is not linked to a Paystack plan yet.");
      }
      const ref = `BSI-${user.id.slice(0, 6)}-${Date.now()}`;
      const handler = await paystackCheckout({
        key: publicKey,
        email: user.email,
        amount: plan.price_ngn * 100,
        currency: "NGN",
        plan: plan.paystack_plan,
        ref,
        callback: async (response) => {
          try {
            const status = await subscribeToPlan(plan.code, response.reference);
            setCurrent(status);
            setSuccess(`You're on ${status.plan_name} now. Welcome aboard!`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Subscription could not be confirmed.");
          } finally {
            setBusy(null);
          }
        },
        onClose: () => setBusy(null),
      });
      handler.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setBusy(null);
    }
  };

  if (plans.length === 0) {
    return (
      <div className="mt-10 text-center text-sm text-muted-foreground">
        {error ?? "Loading plans…"}
      </div>
    );
  }

  return (
    <div className="mt-10">
      {error && (
        <div className="mx-auto mb-6 flex max-w-xl items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mx-auto mb-6 flex max-w-xl items-start gap-2 rounded-md border border-primary/40 bg-primary/5 p-3 text-sm text-primary">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = current?.plan === plan.code;
          const highlighted = plan.code === "pro";
          return (
            <Card key={plan.code} className={highlighted ? "border-primary shadow-lg" : undefined}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  {plan.name}
                  {isCurrent && <Badge variant="success">Current</Badge>}
                </CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    ₦{plan.price_ngn.toLocaleString()}
                  </span>
                  <span className="text-sm text-muted-foreground"> / month</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {(FEATURES[plan.code] ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                {plan.code === "free" ? (
                  <Button variant="outline" className="w-full" disabled>
                    {isCurrent ? "Your current plan" : "Free"}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    disabled={busy !== null || isCurrent}
                    onClick={() => startCheckout(plan)}
                  >
                    {busy === plan.code && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isCurrent ? "Your current plan" : `Upgrade to ${plan.name}`}
                  </Button>
                )}
                {plan.code !== "free" && (
                  <p className="text-center text-xs text-muted-foreground">
                    Powered by Paystack · pay by card, bank transfer or USSD
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Questions?{" "}
        <Link href="/" className="text-primary hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}
