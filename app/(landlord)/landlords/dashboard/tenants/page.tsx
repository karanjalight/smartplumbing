import { Suspense } from "react";

import { LandlordTenantsPageClient } from "@/components/landlord/landlord-tenants-page-client";

export const metadata = {
  title: "Tenants — Landlord portal",
  description: "Add, edit, or remove tenants and manage unit assignments.",
};

export default function LandlordTenantsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading tenants…
        </div>
      }
    >
      <LandlordTenantsPageClient />
    </Suspense>
  );
}
