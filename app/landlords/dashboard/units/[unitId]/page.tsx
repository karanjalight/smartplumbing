import { notFound } from "next/navigation";

import { UnitDetailView } from "@/components/dashboard/unit-detail-view";
import { getUnitDetail, type UnitDetail } from "@/lib/units/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ unitId: string }> };

async function resolve(unitId: string): Promise<UnitDetail | null> {
  try {
    const client = await getSupabaseServerClient();
    return await getUnitDetail(client, unitId);
  } catch {
    return null;
  }
}

export default async function LandlordUnitDetailPage({ params }: Props) {
  const { unitId } = await params;
  const detail = await resolve(unitId);
  if (!detail) notFound();
  return <UnitDetailView detail={detail} portal="landlord" />;
}
