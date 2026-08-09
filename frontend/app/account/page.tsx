"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, CreditCard, Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cancelSubscription, getBillingStatus } from "@/lib/api";
import type { BillingStatus } from "@/lib/types";

export default function AccountPage() {
  const { user, logout } = useAuth();
  const [status, setStatus] = React.useState<BillingStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(() => {
    getBillingStatus().then(setStatus).catch(() => setError("Could not load billing info."));
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCancel = async () => {
    if (!window.confirm("Cancel your subscription? You'll go back to the Free plan at the end of the period.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const s = await cancelSubscription();
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel subscription.");
    } finally {
      setBusy(false);
    }
  };

  const used = status?.statements_used ?? 0;
  const limit = status?.monthly_limit;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <main className="container max-w-3xl py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CreditCard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Account & Billing</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Your plan
              <Badge variant={status?.plan === "free" ? "outline" : "success"}>
                {status ? status.plan_name : "…"}
              </Badge>
            </CardTitle>
            <CardDescription>
              {status?.unlimited
                ? "Unlimited statements per month."
                : `${limit ?? 0} statements per month on the Free plan.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {status && !status.unlimited && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {used} of {limit} used this month
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {pct >= 100 && (
                  <p className="mt-2 text-xs text-destructive">
                    You&apos;ve used your free allowance. Upgrade to keep processing.
                  </p>
                )}
              </div>
            )}

            {status?.expires_at && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Renews on {new Date(status.expires_at).toLocaleDateString()}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {status?.plan === "free" ? (
                <Button asChild>
                  <Link href="/pricing">Upgrade to Pro</Link>
                </Button>
              ) : (
                <Button variant="outline" disabled={busy} onClick={handleCancel}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel subscription
                </Button>
              )}
              <Button variant="ghost" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Need help?</CardTitle>
            <CardDescription>
              Managing your subscription or payments is handled securely by Paystack.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Payment receipts come from Paystack. To change payment methods or billing details,
              contact support and reference your Paystack customer code
              {status?.customer_code ? ` (${status.customer_code})` : ""}.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
