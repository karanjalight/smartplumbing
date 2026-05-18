/**
 * Supabase environment variables.
 *
 * Public URL + anon key are optional at module load so the app can render
 * before `.env.local` is filled; callers that need a client must use
 * `requirePublicSupabaseConfig()` or check `getPublicSupabaseConfig()` first.
 *
 * Service role is only read on the server when admin APIs run.
 */

export type PublicSupabaseConfig = {
  url: string;
  anonKey: string;
};

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function requirePublicSupabaseConfig(): PublicSupabaseConfig {
  const c = getPublicSupabaseConfig();
  if (!c) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local (see docs/SUPABASE.md)."
    );
  }
  return c;
}

function requiredServer(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (see docs/SUPABASE.md).`
    );
  }
  return value.trim();
}

/**
 * Service-role key — server only. Never expose to the browser.
 */
export function getServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must never be exposed in the browser."
    );
  }
  return requiredServer(
    "SUPABASE_SERVICE_ROLE_KEY",
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
