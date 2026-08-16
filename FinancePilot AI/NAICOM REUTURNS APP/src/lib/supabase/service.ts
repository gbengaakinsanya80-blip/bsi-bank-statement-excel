import "server-only";

import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, serviceRoleKey, supabaseUrl } from "@/lib/config";

/**
 * Service-role client. Server-only by design — never import from
 * client components. Used for privileged operations (imports,
 * cron, admin overrides) that must bypass RLS.
 */
export function createServiceClient() {
  if (!isSupabaseConfigured || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
