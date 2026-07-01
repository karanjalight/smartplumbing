import { redirect } from "next/navigation";

import { resolveLandlordAccess } from "@/lib/landlord/access";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resolves the signed-in landlord for a Server Component / Server Action.
 * Redirects to /landlords/login when the caller is not a landlord with a row.
 */
export async function requireLandlord() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role = null;
  let landlordId = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles").select("role").eq("id", user.id).maybeSingle();
    role = profile?.role ?? null;
    const { data: landlord } = await supabase
      .from("landlords").select("id").eq("profile_id", user.id).maybeSingle();
    landlordId = landlord?.id ?? null;
  }

  const access = resolveLandlordAccess({ userId: user?.id ?? null, role, landlordId });
  if (access.kind === "redirect") redirect(access.to);
  return { supabase, landlordId: access.landlordId };
}
