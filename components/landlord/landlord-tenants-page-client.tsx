"use client";

import { LandlordSessionGate } from "@/components/landlord/landlord-session-gate";
import { LandlordTenantsView } from "@/components/landlord/landlord-tenants-view";

export function LandlordTenantsPageClient() {
  return (
    <LandlordSessionGate>
      {(landlord) => <LandlordTenantsView landlordId={landlord.id} />}
    </LandlordSessionGate>
  );
}
