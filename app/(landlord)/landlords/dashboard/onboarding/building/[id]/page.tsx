import { notFound, redirect } from "next/navigation";

import { BuildingOnboardingView } from "@/components/landlord/onboarding/building-onboarding-view";
import { fetchSignedInLandlord } from "@/lib/landlord-session";
import { landlordOnboardingPaths } from "@/lib/onboarding/paths";
import { getBuildingOnboardingDetail } from "@/lib/onboarding/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Building onboarding — Landlord portal",
  description: "Add tenants and leases to each unit in this building.",
};

export default async function BuildingOnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();
  const landlord = await fetchSignedInLandlord(supabase);
  if (!landlord) {
    redirect("/auth/login");
  }
  const detail = await getBuildingOnboardingDetail(supabase, landlord.id, id);
  if (!detail) notFound();
  return (
    <BuildingOnboardingView
      building={detail.building}
      onboarding={detail.onboarding}
      paths={landlordOnboardingPaths()}
    />
  );
}
