/**
 * Route strings that make the shared onboarding views (`OnboardingHubView`,
 * `BuildingOnboardingView`) portal-aware. Plain serializable strings so a Server
 * Component can compute them and pass them to a view as a prop.
 *
 * Base paths are combined with an id at call sites, e.g. `${leaseBase}/${id}`.
 */
export type OnboardingPaths = {
  portal: "admin" | "landlord";
  /** Admin: the landlord being set up. Undefined in the landlord portal. */
  landlordId?: string;
  /** Overview / "back" link. */
  hubHref: string;
  /** Building onboarding page base → `${buildingBase}/${id}`. */
  buildingBase: string;
  /** Building detail (add/edit houses) base → `${buildingDetailBase}/${id}`. */
  buildingDetailBase: string;
  /** Tenant-create wizard base (query string added by the caller). */
  tenantNewBase: string;
  /** Lease detail base → `${leaseBase}/${id}`; also the lease-draft redirect target. */
  leaseBase: string;
  /** Building-create wizard entry, including the onboarding flow flag. */
  newBuildingHref: string;
};

const LANDLORD_BASE = "/landlords/dashboard";
const ADMIN_BASE = "/dashboard";

/** Paths for the landlord portal (scoped to the signed-in landlord). */
export function landlordOnboardingPaths(): OnboardingPaths {
  return {
    portal: "landlord",
    hubHref: `${LANDLORD_BASE}/onboarding`,
    buildingBase: `${LANDLORD_BASE}/onboarding/building`,
    buildingDetailBase: `${LANDLORD_BASE}/buildings`,
    tenantNewBase: `${LANDLORD_BASE}/tenants/new`,
    leaseBase: `${LANDLORD_BASE}/leases`,
    newBuildingHref: `${LANDLORD_BASE}/buildings/new?flow=onboarding`,
  };
}

/** Paths for the admin dashboard, setting up on behalf of `landlordId`. */
export function adminOnboardingPaths(landlordId: string): OnboardingPaths {
  return {
    portal: "admin",
    landlordId,
    hubHref: `${ADMIN_BASE}/onboarding/landlord/${landlordId}`,
    buildingBase: `${ADMIN_BASE}/onboarding/building`,
    buildingDetailBase: `${ADMIN_BASE}/buildings`,
    tenantNewBase: `${ADMIN_BASE}/tenants/new`,
    leaseBase: `${ADMIN_BASE}/leases`,
    newBuildingHref: `${ADMIN_BASE}/buildings/new?flow=onboarding&landlordId=${landlordId}`,
  };
}

/** Whitelist of valid lease-draft redirect bases (guards the server action). */
export const LEASE_REDIRECT_BASES = [
  `${ADMIN_BASE}/leases`,
  `${LANDLORD_BASE}/leases`,
] as const;
