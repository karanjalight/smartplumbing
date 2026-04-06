import { Suspense } from "react";

import { LandlordPayoutDetailPage } from "@/components/landlord/landlord-payout-detail-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  return {
    title: `Payout ${id} — Finance — Landlord portal`,
    description: "Tenant payments attributed to this payout batch.",
  };
}

export default async function LandlordPayoutDetailRoute({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">Loading payout…</div>
      }
    >
      <LandlordPayoutDetailPage payoutId={id} landlordId={LANDLORD_PORTAL_LANDLORD_ID} />
    </Suspense>
  );
}
