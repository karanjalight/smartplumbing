import { redirect } from "next/navigation";

import { OnboardMeterView } from "@/components/dashboard/onboard-meter-view";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Onboard meter — Landlord portal",
  description: "Register and validate an STS smart water meter for your portfolio.",
};

export default async function LandlordOnboardMeterPage() {
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
  return (
    <OnboardMeterView
      successRedirectHref="/landlords/dashboard/meters"
      cancelHref="/landlords/dashboard/meters"
    />
  );
}
