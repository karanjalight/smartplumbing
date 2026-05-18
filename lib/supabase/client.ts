/**
 * Browser-side Supabase client. Safe to import from `"use client"` components.
 *
 * Uses `@supabase/ssr` so cookies set by the server stay in sync after
 * sign-in / sign-out / token refresh.
 */

"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

/** Returns null when public Supabase env is not set (e.g. local demo without DB). */
export function tryGetSupabaseBrowserClient(): ReturnType<
  typeof createBrowserClient<Database>
> | null {
  const cfg = getPublicSupabaseConfig();
  if (!cfg) return null;
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(cfg.url, cfg.anonKey);
  }
  return browserClient;
}

/** Throws if Supabase URL / anon key are missing. */
export function getSupabaseBrowserClient(): ReturnType<
  typeof createBrowserClient<Database>
> {
  const c = tryGetSupabaseBrowserClient();
  if (!c) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
    );
  }
  return c;
}
