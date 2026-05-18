import { redirect } from "next/navigation";

import { CreateBuildingView } from "@/components/buildings/create-building-view";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Add building — Landlord portal",
  description: "Create a new property and houses under your portfolio.",
};

export default async function LandlordNewBuildingPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/landlords/login");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "landlord") {
    redirect("/landlords/login");
  }
  return (
    <CreateBuildingView
      variant="landlord"
      listHref="/landlords/dashboard/buildings"
    />
  );
}
