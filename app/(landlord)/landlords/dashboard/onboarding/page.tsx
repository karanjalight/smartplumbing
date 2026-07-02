import { redirect } from "next/navigation";

import { OnboardingHubView } from "@/components/landlord/onboarding/onboarding-hub-view";
import { fetchSignedInLandlord } from "@/lib/landlord-session";
import { landlordOnboardingPaths } from "@/lib/onboarding/paths";
import { getLandlordOnboardingOverview } from "@/lib/onboarding/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Onboarding — Landlord portal",
  description: "Bring a property online: building, houses, tenants and leases.",
};

export default async function LandlordOnboardingPage() {
  const supabase = await getSupabaseServerClient();
  const landlord = await fetchSignedInLandlord(supabase);
  if (!landlord) {
    redirect("/auth/login");
  }
  const overview = await getLandlordOnboardingOverview(supabase, landlord.id);
  return (
    <OnboardingHubView overview={overview} paths={landlordOnboardingPaths()} />
  );
}
