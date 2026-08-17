"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Building2,
  ShieldCheck,
  Users,
  LogOut,
  Shield,
  ClipboardList,
  CalendarDays,
  Scale,
  Upload,
  BarChart3,
  Wallet,
  Percent,
  SlidersHorizontal,
  FileSearch,
  UsersRound,
  ScrollText,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { signOutAction } from "@/lib/auth/actions";
import { NotificationBell } from "@/components/layout/notification-bell";
import { GlobalSearch } from "@/components/layout/global-search";
import type { AppUser } from "@/lib/types/database";
import type { AppNotification } from "@/lib/compliance/notifications";

const NAV_GROUPS: { label: string | null; items: { href: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/policies", label: "Policies", icon: FileText },
      { href: "/returns", label: "Returns", icon: ClipboardList },
      { href: "/returns/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/import", label: "Import", icon: Upload },
    ],
  },
  {
    label: "Reports",
    items: [
      { href: "/reports/management", label: "Management", icon: BarChart3 },
      { href: "/reports/premium", label: "Premium", icon: Wallet },
      { href: "/reports/commission", label: "Commission", icon: Percent },
      { href: "/reports/compliance", label: "Compliance", icon: FileSearch },
      { href: "/reports/builder", label: "Report builder", icon: SlidersHorizontal },
      { href: "/reports/reconciliation", label: "Reconciliation", icon: Scale },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/board", label: "Board Meetings", icon: UsersRound },
      { href: "/audit", label: "Audit Trail", icon: ScrollText },
    ],
  },
  {
    label: "Masters",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/insurers", label: "Insurers", icon: ShieldCheck },
      { href: "/staff", label: "Staff", icon: Users },
      { href: "/training", label: "Training", icon: GraduationCap },
    ],
  },
];

const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export function AppShell({
  user,
  preview = false,
  notifications = [],
  children,
}: {
  user: AppUser;
  preview?: boolean;
  notifications?: AppNotification[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">Worldmark Hub</p>
            <p className="text-[11px] text-muted-foreground">NAICOM Returns</p>
          </div>
          {preview && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              PREVIEW
            </span>
          )}
          <div className="ml-auto">
            <NotificationBell notifications={notifications} />
          </div>
        </div>
        <nav className="flex-1 space-y-4 p-3">
          <GlobalSearch />
          {NAV_GROUPS.map((group) => (
            <div key={group.label ?? "main"} className="space-y-1">
              {group.label && (
                <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold uppercase">
              {(user.name ?? user.email).slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium">{user.name ?? "User"}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user.role.replace("_", " ")}
              </p>
            </div>
          </div>
          <form action={signOutAction} className="mt-2">
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Shield className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold">Worldmark Hub</span>
          {preview && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              PREVIEW
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell notifications={notifications} />
            <form action={signOutAction}>
              <button type="submit" className="text-muted-foreground hover:text-foreground">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </header>
        <div className="border-b bg-background px-3 py-2 md:hidden">
          <GlobalSearch />
        </div>
        <nav className="flex gap-1 overflow-x-auto border-b bg-background px-2 py-1.5 md:hidden">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
