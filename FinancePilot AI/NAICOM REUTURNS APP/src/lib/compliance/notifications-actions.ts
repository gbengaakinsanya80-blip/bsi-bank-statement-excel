"use server";

import { requireAppUser } from "@/lib/auth/guard";
import { markDemoNotificationsRead } from "@/lib/compliance/notifications";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";

export type NotificationsActionResult = { ok: true } | { ok: false; error: string };

export async function markNotificationsReadAction(ids: string[]): Promise<NotificationsActionResult> {
  try {
    await requireAppUser();
    if (!isSupabaseConfigured) {
      await markDemoNotificationsRead(ids);
      return { ok: true };
    }
    const supabase = await createServerSupabase();
    if (!supabase) return { ok: false, error: "Supabase is not configured." };
    const { error } = await supabase
      .from("user_notifications")
      .update({ read: true })
      .in("id", ids);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update notifications.",
    };
  }
}
