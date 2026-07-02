import { redirect } from "next/navigation";

import { AdminOnboardingHome } from "@/components/dashboard/onboarding/admin-onboarding-home";
import { listLandlordsWithOnboardingStats } from "@/lib/onboarding/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Onboarding — Mali Smart Admin",
  description: "Set up a property on behalf of a landlord — end to end.",
};

export default async function AdminOnboardingPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/auth/login");

  const landlords = await listLandlordsWithOnboardingStats(supabase);
  return <AdminOnboardingHome landlords={landlords} />;
}
