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
      return { title: `${data.name} — Buildings — Mali Smart Admin` };
    }
  } catch {
    /* env / network */
  }
  const b = getBuildingById(id);
  return {
    title: b ? `${b.name} — Buildings — Mali Smart Admin` : "Building — Mali Smart Admin",
  };
}

export default async function BuildingDetailPage({ params }: Props) {
  const { id } = await params;

  let initialDetail: Awaited<ReturnType<typeof loadBuildingDetailFromSupabase>> = null;
  try {
    const supabase = await getSupabaseServerClient();
    initialDetail = await loadBuildingDetailFromSupabase(supabase, { buildingId: id });
  } catch {
    /* client fallback (demo seed) */
  }

  return (
    <BuildingDetailView buildingId={id} initialDetail={initialDetail ?? undefined} />
  );
}
