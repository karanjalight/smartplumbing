import { Suspense } from "react";

import { LandlordTenantsView } from "@/components/landlord/landlord-tenants-view";
import { LANDLORD_PORTAL_LANDLORD_ID } from "@/lib/landlord-finance-data";

export const metadata = {
  title: "Tenants — Landlord portal",
  description: "Add, edit, or remove tenants and manage unit assignments.",
};

export default function LandlordTenantsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">Loading tenants…</div>
      }
    >
      <LandlordTenantsView landlordId={LANDLORD_PORTAL_LANDLORD_ID} />
    </Suspense>
  );
}
