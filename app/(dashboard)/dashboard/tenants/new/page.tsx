import { CreateTenantView } from "@/components/dashboard/create-tenant-view";

export const metadata = {
  title: "Create tenant — Mali Smart Admin",
  description:
    "Register a new tenant with lease, landlord, building, and STS meter details.",
};

export default async function CreateTenantPage({
  searchParams,
}: {
  searchParams: Promise<{
    landlordId?: string;
    buildingId?: string;
    unitId?: string;
    next?: string;
  }>;
}) {
  const { landlordId, buildingId, unitId, next } = await searchParams;
  // Only honour same-origin relative paths to avoid open-redirects.
  const successHref =
    next && next.startsWith("/") && !next.startsWith("//") ? next : undefined;
  return (
    <CreateTenantView
      initialLandlordId={landlordId || undefined}
      initialBuildingId={buildingId || undefined}
      initialUnitId={unitId || undefined}
      successHref={successHref}
    />
  );
}
