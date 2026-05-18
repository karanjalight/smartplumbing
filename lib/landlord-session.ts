/**
 * Resolve the signed-in landlord's portfolio record (browser or server client).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import type { Landlord } from "@/lib/tenants-data";

export type SignedInLandlord = Landlord & {
  /** Display code when present (e.g. LND-001). */
  code: string | null;
};

export async function fetchSignedInLandlord(
  client: SupabaseClient<Database>,
): Promise<SignedInLandlord | null> {
  const {
    data: { user },
    error: authErr,
  } = await client.auth.getUser();
  if (authErr || !user) return null;

  const { data, error } = await client
    .from("landlords")
    .select("id, code, full_name, company, phone, email")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    code: data.code,
    name: data.full_name,
    company: data.company?.trim() || "—",
    phone: data.phone?.trim() || "—",
    email: data.email?.trim() || "—",
  };
}
