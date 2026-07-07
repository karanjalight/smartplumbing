import { redirect } from "next/navigation";

import { BulkImportMetersView } from "@/components/dashboard/bulk-import-meters-view";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Import meters — Landlord portal",
  description: "Bulk register STS smart water meters for your portfolio.",
};

export default async function LandlordImportMetersPage() {
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
    <BulkImportMetersView
      successRedirectHref="/landlords/dashboard/meters"
      cancelHref="/landlords/dashboard/meters"
    />
  );
}
