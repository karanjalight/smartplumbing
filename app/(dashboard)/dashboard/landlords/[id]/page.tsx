import { notFound } from "next/navigation";

import { LandlordDetailView } from "@/components/dashboard/landlord-detail-view";
import {
  fetchLandlordRowById,
  getLandlordRows,
} from "@/lib/landlords-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ id: string }> };

async function resolveLandlord(id: string) {
  try {
    const supabase = await getSupabaseServerClient();
    const fromDb = await fetchLandlordRowById(supabase, id);
    if (fromDb) return fromDb;
  } catch {
    /* fall through to mock */
  }
  return getLandlordRows().find((r) => r.id === id) ?? null;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await resolveLandlord(id);
  return {
    title: row
      ? `${row.company} — Landlord — Smart Plumbing Admin`
      : "Landlord — Smart Plumbing Admin",
    description: "Landlord profile, buildings, tenants, payouts, and portfolio metrics.",
  };
}

export default async function LandlordDetailPage({ params }: Props) {
  const { id } = await params;
  const row = await resolveLandlord(id);
  if (!row) notFound();
  return <LandlordDetailView landlord={row} />;
}
