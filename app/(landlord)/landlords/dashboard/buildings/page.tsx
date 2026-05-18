import { redirect } from "next/navigation";

import { LandlordBuildingsView } from "@/components/landlord/landlord-buildings-view";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Buildings — Landlord portal",
  description: "Manage multiple buildings and properties from one account.",
};

export default async function LandlordBuildingsPage() {
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
  const { data: landlord } = await supabase
    .from("landlords")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!landlord?.id) {
    redirect("/landlords/login");
  }
  return <LandlordBuildingsView landlordId={landlord.id} />;
}
