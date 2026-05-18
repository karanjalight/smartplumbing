/**
 * Supabase auth-refresh middleware helper.
 *
 * Usage (root `middleware.ts`):
 *
 *   import { type NextRequest } from "next/server";
 *   import { updateSession } from "@/lib/supabase/middleware";
 *
 *   export async function middleware(request: NextRequest) {
 *     return updateSession(request);
 *   }
 *
 * This keeps the access token fresh on every navigation so server-rendered
 * pages can read the current user via `getSupabaseServerClient()`.
 */

import { type NextRequest, NextResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

export async function updateSession(request: NextRequest) {
  const cfg = getPublicSupabaseConfig();
  if (!cfg) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(cfg.url, cfg.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set({ name, value, ...options });
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}
