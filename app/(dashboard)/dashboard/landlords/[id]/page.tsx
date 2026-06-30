import { notFound } from "next/navigation";

import { OwnerStatementView } from "@/components/owners/owner-statement";
import { LandlordDetailView } from "@/components/dashboard/landlord-detail-view";
import { assembleOwnerStatement, type OwnerStatementBundle } from "@/lib/owners/queries";
import {
  fetchLandlordRowById,
  getLandlordRows,
} from "@/lib/landlords-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
};

function currentPeriod(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

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

async function resolveStatement(
  id: string, period: string
): Promise<OwnerStatementBundle | null> {
  try {
    const supabase = await getSupabaseServerClient();
    return await assembleOwnerStatement(supabase, id, period);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const row = await resolveLandlord(id);
  return {
    title: row
      ? `${row.company} — Landlord — Mali Smart Admin`
      : "Landlord — Mali Smart Admin",
    description: "Landlord profile, buildings, tenants, payouts, and portfolio metrics.",
  };
}

export default async function LandlordDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { period: periodParam } = await searchParams;
  const row = await resolveLandlord(id);
  if (!row) notFound();

  const period = /^\d{6}$/.test(periodParam ?? "") ? (periodParam as string) : currentPeriod();
  const statement = await resolveStatement(id, period);

  return (
    <>
      <LandlordDetailView landlord={row} />
      {statement && (
        <section className="space-y-4 p-4 md:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Owner statement
          </h2>
          <OwnerStatementView landlordId={id} period={period} bundle={statement} />
        </section>
      )}
    </>
  );
}
