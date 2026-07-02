"use client";

import { useEffect, useState } from "react";

import { dashboardPathForRole } from "@/lib/auth/routes";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/supabase/types";

export type AuthNav = {
  /** Whether a user session has been confirmed. */
  signedIn: boolean;
  /** The dashboard for the signed-in user's role, or null when signed out. */
  dashboardHref: string | null;
};

/**
 * Client hook for auth-aware navigation (e.g. the marketing nav). Defaults to
 * signed-out so the "Sign in" CTA renders immediately, then upgrades to the
 * user's dashboard once a session is confirmed.
 */
export function useAuthNav(): AuthNav {
  const [state, setState] = useState<AuthNav>({
    signedIn: false,
    dashboardHref: null,
  });

  useEffect(() => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) return; // stays signed-out → shows "Sign in"

    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setState({ signedIn: false, dashboardHref: null });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const role = (profile?.role ?? "tenant") as UserRole;
      setState({ signedIn: true, dashboardHref: dashboardPathForRole(role) });
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => void load());

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}
