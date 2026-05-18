"use client";

import { useEffect, useState } from "react";

import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

export type DisplayAccount = {
  name: string;
  email: string;
  initials: string;
};

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function buildDisplayAccount(
  user: {
    email?: string | null;
    user_metadata?: Record<string, unknown>;
  },
  profile: { full_name?: string; email?: string | null } | null
): DisplayAccount {
  const metaName = user.user_metadata?.full_name;
  const name =
    profile?.full_name?.trim() ||
    (typeof metaName === "string" ? metaName.trim() : "") ||
    user.email?.split("@")[0] ||
    "Account";
  const email = profile?.email?.trim() || user.email || "";
  return { name, email, initials: initialsFromName(name) };
}

export function useCurrentProfile(fallback: DisplayAccount): DisplayAccount {
  const [account, setAccount] = useState<DisplayAccount>(fallback);

  useEffect(() => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) return;

    let cancelled = false;

    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setAccount(fallback);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .maybeSingle();

      if (!cancelled) {
        setAccount(buildDisplayAccount(user, profile));
      }
    };

    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fallback.email, fallback.initials, fallback.name]);

  return account;
}
