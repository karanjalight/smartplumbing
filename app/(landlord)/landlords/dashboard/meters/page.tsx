import { redirect } from "next/navigation";

import { LandlordMetersView } from "@/components/landlord/landlord-meters-view";
import { fetchMeterRowsForLandlord } from "@/lib/meters-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Meters — Landlord portal",
  description: "Smart water meters across your buildings and tenant units.",
};

export default async function LandlordMetersPage() {
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
  const { data: landlord } = await supabase
    .from("landlords")
    .select("id")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!landlord?.id) {
    redirect("/auth/login");
  }

  let initialRows: Awaited<ReturnType<typeof fetchMeterRowsForLandlord>> = [];
  let initialListSource: "supabase" | "mock" = "supabase";
  try {
    initialRows = await fetchMeterRowsForLandlord(supabase, landlord.id);
  } catch {
    initialListSource = "mock";
  }

  return (
    <LandlordMetersView
      landlordId={landlord.id}
      initialRows={initialListSource === "supabase" ? initialRows : undefined}
      initialListSource={initialListSource}
    />
  );
}
