import { BuildingDetailView } from "@/components/dashboard/building-detail-view";
import { getBuildingById } from "@/lib/buildings-data";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const b = getBuildingById(id);
  return {
    title: b
      ? `${b.name} — Buildings — Smart Plumbing Admin`
      : "Building — Smart Plumbing Admin",
  };
}

export default async function BuildingDetailPage({ params }: Props) {
  const { id } = await params;
  return <BuildingDetailView buildingId={id} />;
}
