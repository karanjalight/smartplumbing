import { redirect } from "next/navigation";

import { CreateBuildingView } from "@/components/buildings/create-building-view";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Add building — Landlord portal",
  description: "Create a new property and houses under your portfolio.",
};

export default async function LandlordNewBuildingPage({
  searchParams,
}: {
  searchParams: Promise<{ flow?: string }>;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/auth/login");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "landlord") {
    redirect("/auth/login");
  }
  const { flow } = await searchParams;
  const onboarding = flow === "onboarding";
  return (
    <CreateBuildingView
      variant="landlord"
      listHref={
        onboarding
          ? "/landlords/dashboard/onboarding"
          : "/landlords/dashboard/buildings"
      }
      successHref={
        onboarding ? "/landlords/dashboard/onboarding/building/:id" : undefined
      }
    />
  );
}
