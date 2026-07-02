import { notFound, redirect } from "next/navigation";

import { OnboardingHubView } from "@/components/landlord/onboarding/onboarding-hub-view";
import { adminOnboardingPaths } from "@/lib/onboarding/paths";
import { getLandlordOnboardingOverview } from "@/lib/onboarding/queries";
import { getLandlordById } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Landlord onboarding — Mali Smart Admin",
  description: "Set up buildings, units, tenants and leases for a landlord.",
};

export default async function AdminLandlordOnboardingPage({
  params,
}: {
  params: Promise<{ landlordId: string }>;
}) {
  const { landlordId } = await params;
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

  const landlord = await getLandlordById(supabase, landlordId);
  if (!landlord) notFound();
  const overview = await getLandlordOnboardingOverview(supabase, landlordId);

  return (
    <OnboardingHubView
      overview={overview}
      paths={adminOnboardingPaths(landlordId)}
      context={{
        label: landlord.company?.trim() || landlord.full_name,
        backHref: "/dashboard/onboarding",
      }}
    />
  );
}
