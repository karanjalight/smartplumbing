"use server";

import { dashboardPathForRole } from "@/lib/auth/routes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { requirePublicSupabaseConfig } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export type SignInWithPasswordResult =
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      passwordMessage?: string;
      formError?: string;
    };

/**
 * The single source of truth for authentication. Verifies email/password on
 * the server, then routes the user to the dashboard for their role — one login
 * for admins, landlords, and tenants.
 *
 * Runs server-side (via @supabase/ssr) so session cookies are written on the
 * server and the browser never makes a cross-origin request to the auth host.
 */
export async function signInWithEmailPassword(input: {
  email: string;
  password: string;
}): Promise<SignInWithPasswordResult> {
  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!email || !password) {
    return {
      ok: false,
      passwordMessage: "Email and password are required.",
    };
  }

  try {
    requirePublicSupabaseConfig();
  } catch (e) {
    return {
      ok: false,
      formError:
        e instanceof Error
          ? e.message
          : "Supabase is not configured. See docs/SUPABASE.md.",
    };
  }

  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { ok: false, passwordMessage: error.message };
  }

  const user = data.user;
  if (!user) {
    return {
      ok: false,
      passwordMessage: "No user was returned from sign-in. Try again.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    await supabase.auth.signOut();
    return {
      ok: false,
      formError:
        profileError.message || "Could not load your profile. Try again.",
    };
  }

  const role = (profile?.role ?? "tenant") as UserRole;
  return { ok: true, redirectTo: dashboardPathForRole(role) };
}

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
