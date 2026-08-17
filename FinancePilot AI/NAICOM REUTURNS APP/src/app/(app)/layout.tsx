import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_SESSION_COOKIE, demoUser } from "@/lib/demo/data";
import { buildCalendarYear } from "@/lib/compliance/calendar";
import {
  deriveBoardNotifications,
  deriveDemoNotifications,
  withReadState,
  type AppNotification,
  type NotificationReturnRef,
} from "@/lib/compliance/notifications";
import { listDemoReturns } from "@/lib/returns/demo-store";
import { getReturnDefinition } from "@/lib/returns/definitions";
import { validateReturn } from "@/lib/compliance/validation";
import { listDemoMeetings } from "@/lib/demo/board-store";
import type { AppUser } from "@/lib/types/database";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) {
    const cookieStore = await cookies();
    if (!cookieStore.get(DEMO_SESSION_COOKIE)) redirect("/login");
    const notifications = await demoNotifications();
    return (
      <AppShell user={demoUser as unknown as AppUser} preview notifications={notifications}>
        {children}
      </AppShell>
    );
  }

  const supabase = await createServerSupabase();
  if (!supabase) redirect("/login");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: userNotifications } = await supabase
    .from("user_notifications")
    .select("id, type, title, body, link, read, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const notifications: AppNotification[] = (userNotifications ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link ?? "/",
    read: n.read,
    createdAt: n.created_at,
  }));

  return (
    <AppShell user={(appUser as AppUser) ?? nullUser(user.email ?? "")} notifications={notifications}>
      {children}
    </AppShell>
  );
}

async function demoNotifications(): Promise<AppNotification[]> {
  const year = new Date().getUTCFullYear();
  const demoReturns = await listDemoReturns();
  const existing: Record<string, { id: string; status: string }> = {};
  for (const r of demoReturns) {
    existing[`${r.code}|${r.period.start}|${r.period.end}`] = { id: r.id, status: r.status };
  }
  const calendar = buildCalendarYear(year, existing);
  const refs: NotificationReturnRef[] = demoReturns.map((r) => {
    const quality = validateReturn(r.code, r.rows);
    return {
      id: r.id,
      name: getReturnDefinition(r.code).name,
      code: r.code,
      periodLabel: r.period.label,
      status: r.status,
      createdAt: r.createdAt,
      quality: { errorCount: quality.errorCount, warningCount: quality.warningCount, hasErrors: quality.hasErrors },
    };
  });
  const boardMeetings = await listDemoMeetings();
  const all = [...deriveDemoNotifications(calendar, refs), ...deriveBoardNotifications(boardMeetings)];
  return withReadState(all);
}

function nullUser(email: string): AppUser {
  return {
    id: "",
    name: null,
    email,
    phone: null,
    role: "VIEWER",
    department: null,
    active: true,
    last_login: null,
    created_at: "",
    updated_at: "",
  };
}
