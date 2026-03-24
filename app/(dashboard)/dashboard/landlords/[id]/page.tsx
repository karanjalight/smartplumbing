import { notFound } from "next/navigation";

import { LandlordDetailView } from "@/components/dashboard/landlord-detail-view";
import { getLandlordRows } from "@/lib/landlords-data";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = getLandlordRows().find((r) => r.id === id);
  return {
    title: row
      ? `${row.company} — Landlord — Smart Plumbing Admin`
      : "Landlord — Smart Plumbing Admin",
    description: "Landlord profile, buildings, tenants, payouts, and portfolio metrics.",
  };
}

export default async function LandlordDetailPage({ params }: Props) {
  const { id } = await params;
  const row = getLandlordRows().find((r) => r.id === id);
  if (!row) notFound();
  return <LandlordDetailView landlord={row} />;
}
