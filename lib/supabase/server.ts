/**
 * Server-side Supabase client for Route Handlers, Server Actions, and Server
 * Components. Honors the user's session via Next.js cookies().
 *
 * Notes:
 *   - In Next.js (this version) `cookies()` is async — see
 *     node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md.
 *   - When called from a pure Server Component (read-only), the cookie store
 *     may not be writable; we catch and ignore the "Cookies can only be
 *     modified in a Server Action or Route Handler" error so reads still work.
 */

import { cookies } from "next/headers";

import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { requirePublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

export async function getSupabaseServerClient() {
  const { url, anonKey } = requirePublicSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set({
              name,
              value,
              ...(options as CookieOptions),
            });
          }
        } catch {
          // Read-only Server Components cannot mutate cookies. The middleware
          // (lib/supabase/middleware.ts) is responsible for refreshing the
          // session, so it is safe to ignore here.
        }
      },
    },
  });
}
