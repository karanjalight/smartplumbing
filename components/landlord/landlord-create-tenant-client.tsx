"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { CreateTenantView } from "@/components/dashboard/create-tenant-view";
import { LandlordSessionGate } from "@/components/landlord/landlord-session-gate";

function LandlordCreateTenantInner() {
  const searchParams = useSearchParams();
  const buildingId =
    searchParams.get("buildingId") ?? searchParams.get("building") ?? undefined;
  const unitId =
    searchParams.get("unitId") ?? searchParams.get("unit") ?? undefined;

  return (
    <LandlordSessionGate>
      {(landlord) => (
        <CreateTenantView
          portal="landlord"
          sessionLandlord={landlord}
          initialBuildingId={buildingId || undefined}
          initialUnitId={unitId || undefined}
        />
      )}
    </LandlordSessionGate>
  );
}

export function LandlordCreateTenantClient() {
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">
          Loading create tenant…
        </p>
      }
    >
      <LandlordCreateTenantInner />
    </Suspense>
  );
}
