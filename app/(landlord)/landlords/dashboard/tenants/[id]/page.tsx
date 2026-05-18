import { Suspense } from "react";

import { LandlordTenantDetailPageClient } from "@/components/landlord/landlord-tenant-detail-page-client";

type PageProps = { params: Promise<{ id: string }> };

export const metadata = {
  title: "Tenant — Landlord portal",
  description: "Tenant profile, STS meter, payments, and building context.",
};

export default async function LandlordTenantDetailRoute({ params }: PageProps) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-muted-foreground">
          Loading tenant…
        </div>
      }
    >
      <LandlordTenantDetailPageClient tenantId={id} />
    </Suspense>
  );
}
