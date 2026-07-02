import { notFound, redirect } from "next/navigation";

import { BuildingOnboardingView } from "@/components/landlord/onboarding/building-onboarding-view";
import { adminOnboardingPaths } from "@/lib/onboarding/paths";
import { getBuildingOnboardingDetail } from "@/lib/onboarding/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Building onboarding — Mali Smart Admin",
  description: "Add tenants and leases to each unit in this building.",
};

export default async function AdminBuildingOnboardingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  // Resolve the building's landlord so we can scope the overview + build paths.
  const { data: building } = await supabase
    .from("buildings")
    .select("landlord_id")
    .eq("id", id)
    .maybeSingle();
  if (!building) notFound();

  const detail = await getBuildingOnboardingDetail(
    supabase,
    building.landlord_id,
    id
  );
  if (!detail) notFound();

  return (
    <BuildingOnboardingView
      building={detail.building}
      onboarding={detail.onboarding}
      paths={adminOnboardingPaths(building.landlord_id)}
    />
  );
}
