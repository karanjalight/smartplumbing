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

export async function generateMetadata({ params }: Props) {
  const { unitId } = await params;
  const detail = await resolve(unitId);
  return {
    title: detail ? `${detail.unit.label} — House — Mali Smart Admin` : "House — Mali Smart Admin",
  };
}

export default async function UnitDetailPage({ params }: Props) {
  const { unitId } = await params;
  const detail = await resolve(unitId);
  if (!detail) notFound();
  return <UnitDetailView detail={detail} portal="admin" />;
}
