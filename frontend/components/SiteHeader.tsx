"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, AlertCircle, BarChart3, Building2, CreditCard, Landmark, LayoutDashboard, History, Link2, LogOut, ScrollText, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { getBillingStatus, healthCheck } from "@/lib/api";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
  { href: "/search", label: "Search", icon: Search },
  { href: "/statements", label: "Statements", icon: Link2 },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/ledger", label: "Ledger", icon: ScrollText },
  { href: "/accounting", label: "Setup", icon: Building2 },
  { href: "/templates", label: "Banks", icon: Landmark },
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, initializing, logout } = useAuth();
  const [apiOnline, setApiOnline] = React.useState<boolean | null>(null);
  const [plan, setPlan] = React.useState<string | null>(null);

  React.useEffect(() => {
    healthCheck().then(setApiOnline);
    const t = setInterval(() => healthCheck().then(setApiOnline), 15000);
    return () => clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (!user) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    getBillingStatus()
      .then((s) => {
        if (!cancelled) setPlan(s.plan);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">Bank Statement Intelligence</p>
            <p className="text-[11px] text-muted-foreground">AI Bank Statement → Excel Converter</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          {apiOnline === true && (
            <Badge variant="success" className="hidden gap-1 sm:inline-flex">
              <Activity className="h-3 w-3" /> API online
            </Badge>
          )}
          {apiOnline === false && (
            <Badge variant="destructive" className="hidden gap-1 sm:inline-flex">
              <AlertCircle className="h-3 w-3" /> API offline
            </Badge>
          )}
          {!initializing && user && (
            <>
              {plan === "free" ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href="/pricing">
                    <Sparkles className="h-4 w-4" /> Upgrade
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="ghost" asChild>
                  <Link href="/account">
                    <Badge variant="success">{plan ?? "Account"}</Badge>
                  </Link>
                </Button>
              )}
              <Button size="sm" variant="ghost" asChild>
                <Link href="/account">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Billing</span>
                </Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={logout}>
                <LogOut className="h-4 w-4" /> Sign out
              </Button>
            </>
          )}
          {!initializing && !user && (
            <Button size="sm" variant="default" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
