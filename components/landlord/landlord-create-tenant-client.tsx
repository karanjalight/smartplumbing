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
  // Only honour same-origin relative paths to avoid open-redirects.
  const nextRaw = searchParams.get("next");
  const successHref =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : undefined;

  return (
    <LandlordSessionGate>
      {(landlord) => (
        <CreateTenantView
          portal="landlord"
          sessionLandlord={landlord}
          initialBuildingId={buildingId || undefined}
          initialUnitId={unitId || undefined}
          successHref={successHref}
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
