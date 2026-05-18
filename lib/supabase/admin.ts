/**
 * Service-role Supabase client. Bypasses RLS — use only inside Route Handlers
 * and Server Actions that have already authorized the caller (e.g. admin
 * signup, webhooks, scheduled jobs).
 *
 * Never import this from a Client Component.
 */

import { createClient } from "@supabase/supabase-js";

import { getServiceRoleKey, requirePublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

let adminClient: ReturnType<typeof createClient<Database>> | undefined;

export function getSupabaseAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "getSupabaseAdminClient() must not be called from the browser."
    );
  }
  if (!adminClient) {
    const { url } = requirePublicSupabaseConfig();
    adminClient = createClient<Database>(url, getServiceRoleKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { "X-SmartOne-Client": "service-role" },
      },
    });
  }
  return adminClient;
}
