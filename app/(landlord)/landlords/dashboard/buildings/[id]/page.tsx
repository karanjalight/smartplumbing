import { redirect } from "next/navigation";

import { BuildingDetailView } from "@/components/dashboard/building-detail-view";
import { getBuildingById, loadBuildingDetailFromSupabase } from "@/lib/buildings-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const supabase = await getSupabaseServerClient();
    const { data } = await supabase.from("buildings").select("name").eq("id", id).maybeSingle();
    if (data?.name) {
      return { title: `${data.name} — Buildings — Landlord portal` };
    }
  } catch {
    /* env / network */
  }
  const b = getBuildingById(id);
  return {
    title: b ? `${b.name} — Buildings — Landlord portal` : "Building — Landlord portal",
  };
}

export default async function LandlordBuildingDetailPage({ params }: Props) {
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
  const { id } = await params;

  let initialDetail: Awaited<ReturnType<typeof loadBuildingDetailFromSupabase>> = null;
  try {
    initialDetail = await loadBuildingDetailFromSupabase(supabase, {
      buildingId: id,
      landlordId: landlord.id,
    });
  } catch {
    /* client fallback (demo / local portfolio) */
  }

  return (
    <BuildingDetailView
      buildingId={id}
      portal="landlord"
      landlordPortalId={landlord.id}
      initialDetail={initialDetail ?? undefined}
    />
  );
}
