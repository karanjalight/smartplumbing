"use client";

import { LandlordSessionGate } from "@/components/landlord/landlord-session-gate";
import { LandlordTenantDetailPage } from "@/components/landlord/landlord-tenant-detail-view";

export function LandlordTenantDetailPageClient({
  tenantId,
}: {
  tenantId: string;
}) {
  return (
    <LandlordSessionGate>
      {(landlord) => (
        <LandlordTenantDetailPage tenantId={tenantId} landlordId={landlord.id} />
      )}
    </LandlordSessionGate>
  );
}
