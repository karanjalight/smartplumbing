import { Suspense } from "react";

import { LandlordTenantDetailPage } from "@/components/landlord/landlord-tenant-detail-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";
import { getTenantById } from "@/lib/tenants-data";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const t = getTenantById(id);
  return {
    title: t ? `${t.name} — Tenant — Landlord portal` : `Tenant — Landlord portal`,
    description: "Tenant profile, STS meter, payments, and building context.",
  };
}

export default async function LandlordTenantDetailRoute({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">Loading tenant…</div>
      }
    >
      <LandlordTenantDetailPage tenantId={id} landlordId={LANDLORD_PORTAL_LANDLORD_ID} />
    </Suspense>
  );
}
