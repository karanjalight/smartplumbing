"use server";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePublicSupabaseConfig } from "@/lib/supabase/env";

export type SignUpAdminResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Creates a new auth user and sets `profiles.role` to `admin`.
 * Uses the service-role client (server only). Anyone who can reach this action
 * can create an admin account — add middleware or a feature flag if you need
 * to lock this down later.
 */
export async function signUpAdmin(input: {
  email: string;
  password: string;
  fullName: string;
}): Promise<SignUpAdminResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;
  const fullName = input.fullName.trim();

  if (!email || !password || password.length < 8) {
    return { ok: false, error: "Enter a valid email and password (min 8 characters)." };
  }
  if (!fullName) {
    return { ok: false, error: "Full name is required." };
  }

  try {
    requirePublicSupabaseConfig();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Supabase is not configured.",
    };
  }

  const admin = getSupabaseAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const userId = data.user?.id;
  if (!userId) {
    return { ok: false, error: "Account was not created. Try again." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: "admin",
      full_name: fullName,
      email,
    })
    .eq("id", userId);

  if (profileError) {
    return {
      ok: false,
      error: profileError.message || "Could not assign admin role to profile.",
    };
  }

  return { ok: true };
}
