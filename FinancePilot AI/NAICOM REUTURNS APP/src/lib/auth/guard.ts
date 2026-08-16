import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import { DEMO_SESSION_COOKIE, demoUser } from "@/lib/demo/data";
import type { AppUser, Role } from "@/lib/types/database";

export interface SessionUser {
  id: string;
  email: string;
}

export async function getSession() {
  const supabase = await createServerSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  return { id: session.user.id, email: session.user.email ?? "" };
}

/** Works in both live and preview (demo) mode. */
export async function requireAppUser(): Promise<SessionUser> {
  if (!isSupabaseConfigured) {
    const cookieStore = await cookies();
    if (!cookieStore.get(DEMO_SESSION_COOKIE)) redirect("/login");
    return { id: demoUser.id, email: demoUser.email };
  }
  return requireUser();
}

export async function requireRole(roles: Role[]): Promise<SessionUser & { appUser: AppUser }> {
  const session = await requireUser();
  const supabase = await createServerSupabase();
  const { data } = await supabase!
    .from("users")
    .select("*")
    .eq("id", session.id)
    .single();

  const appUser = data as AppUser | null;
  if (!appUser || !roles.includes(appUser.role)) redirect("/dashboard");
  return { ...session, appUser };
}
