import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePublicSupabaseConfig } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdminActorResult =
  | { ok: true; admin: ReturnType<typeof getSupabaseAdminClient> }
  | { ok: false; error: string };

/**
 * Verify the caller is a signed-in admin and return the service-role client for the write.
 * RLS (<table>_admin_full) is still enforced as a second line of defense on the anon client,
 * but delete/cascade counting uses the returned admin client for consistency.
 */
export async function assertAdmin(): Promise<AdminActorResult> {
  try {
    requirePublicSupabaseConfig();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Supabase is not configured." };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();
  if (authErr || !user) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profileErr || !profile) {
    return { ok: false, error: "Could not load your profile." };
  }
  if (profile.role !== "admin") {
    return { ok: false, error: "You do not have permission for this action." };
  }

  return { ok: true, admin: getSupabaseAdminClient() };
}
