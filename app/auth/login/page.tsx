import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthPageShell } from "@/components/admin-page-shell";
import { SignInForm } from "@/components/sign-in-form";
import { dashboardPathForRole } from "@/lib/auth/routes";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Access your meters, invoices, and customer records with Mali Smart.",
};

/** Where an already-signed-in visitor should be sent, or null to show the form. */
async function alreadySignedInRedirect(): Promise<string | null> {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    return dashboardPathForRole((profile?.role ?? "tenant") as UserRole);
  } catch {
    return null; // env not configured / not signed in → show the form
  }
}

export default async function LoginPage() {
  const target = await alreadySignedInRedirect();
  if (target) redirect(target);

  return (
    <AuthPageShell>
      <SignInForm />
    </AuthPageShell>
  );
}
