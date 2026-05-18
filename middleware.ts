/**
 * Root middleware — keeps the Supabase auth session fresh on every navigation.
 *
 * The matcher excludes static assets and PWA files so we never refresh the
 * session for the service worker, icons, or Next's internal asset routes.
 */

import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon-192.svg|icon-512.svg|sw.js|manifest.webmanifest|api/longi|api/paystack).*)",
  ],
};
