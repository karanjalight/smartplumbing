import type { SupabaseClient } from "@supabase/supabase-js";

import { listLeases } from "@/lib/leases/queries";
import {
  listBuildingsForLandlord,
  listLandlords,
  listTenantsForLandlord,
} from "@/lib/supabase/queries";
import type {
  BuildingRow,
  Database,
  LeaseRow,
  LeaseStatus,
  RentModel,
  TenantRow,
  UnitRow,
  UnitType,
} from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

/** Landlord + a light onboarding-progress summary, for the admin front door. */
export type LandlordOnboardingStat = {
  id: string;
  name: string;
  company: string | null;
  code: string | null;
  buildings: number;
  units: number;
  activeLeases: number;
};

/**
 * Every landlord with coarse onboarding counts (buildings / units / active
 * leases), for the admin onboarding front door. Admin RLS returns all rows;
 * aggregated in JS from a few full selects.
 */
export async function listLandlordsWithOnboardingStats(
  client: Client
): Promise<LandlordOnboardingStat[]> {
  const [landlords, buildingsRes, unitsRes, leasesRes] = await Promise.all([
    listLandlords(client),
    client.from("buildings").select("id, landlord_id"),
    client.from("units").select("id, building_id"),
    client.from("leases").select("landlord_id, status"),
  ]);
  if (buildingsRes.error) throw buildingsRes.error;
  if (unitsRes.error) throw unitsRes.error;
  if (leasesRes.error) throw leasesRes.error;

  const buildingLandlord = new Map<string, string>();
  const buildingsPerLandlord = new Map<string, number>();
  for (const b of buildingsRes.data ?? []) {
    buildingLandlord.set(b.id, b.landlord_id);
    buildingsPerLandlord.set(
      b.landlord_id,
      (buildingsPerLandlord.get(b.landlord_id) ?? 0) + 1
    );
  }
  const unitsPerLandlord = new Map<string, number>();
  for (const u of unitsRes.data ?? []) {
    const landlordId = buildingLandlord.get(u.building_id);
    if (!landlordId) continue;
    unitsPerLandlord.set(landlordId, (unitsPerLandlord.get(landlordId) ?? 0) + 1);
  }
  const activeLeasesPerLandlord = new Map<string, number>();
  for (const l of leasesRes.data ?? []) {
    if (l.status !== "active") continue;
    activeLeasesPerLandlord.set(
      l.landlord_id,
      (activeLeasesPerLandlord.get(l.landlord_id) ?? 0) + 1
    );
  }

  return landlords.map((l) => ({
    id: l.id,
    name: l.full_name,
    company: l.company,
    code: l.code,
    buildings: buildingsPerLandlord.get(l.id) ?? 0,
    units: unitsPerLandlord.get(l.id) ?? 0,
    activeLeases: activeLeasesPerLandlord.get(l.id) ?? 0,
  }));
}

/**
 * Where a single unit sits in the onboarding journey. Derived from the unit's
 * tenant (via `tenants.unit_id`) and that tenant's most-recent lease — never
 * stored.
 */
export type OnboardingUnitState =
  | "vacant" // no tenant assigned
  | "occupied_no_lease" // tenant assigned, no lease yet
  | "lease_draft" // lease created, not generated/sent
  | "lease_pending_signature" // generated, awaiting signatures
  | "lease_active" // fully signed / active — done
  | "lease_inactive"; // expired / terminated / cancelled — needs attention

export type OnboardingUnit = {
  id: string;
  label: string;
  unitType: UnitType | null;
  rentKes: number | null;
  isVacant: boolean;
  tenantId: string | null;
  tenantName: string | null;
  leaseId: string | null;
  leaseStatus: LeaseStatus | null;
  state: OnboardingUnitState;
};

export type OnboardingBuilding = {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  region: string | null;
  rentModel: RentModel;
  rentKes: number;
  unitCount: number;
  occupiedCount: number;
  vacantCount: number;
  leaseActiveCount: number;
  leaseInProgressCount: number; // draft + pending_signature
  needsAttentionCount: number; // occupied_no_lease + lease_inactive
  completedCount: number; // lease_active
  /** true when the building has at least one unit and every unit is fully leased. */
  isComplete: boolean;
  units: OnboardingUnit[];
};

export type OnboardingOverview = {
  buildings: OnboardingBuilding[];
  totals: {
    buildings: number;
    units: number;
    occupied: number;
    vacant: number;
    tenants: number;
    leasesActive: number;
    leasesInProgress: number;
    unitsNeedingTenant: number;
    unitsNeedingLease: number;
    buildingsWithoutUnits: number;
  };
};

const ACTIVE_LEASE_STATES: LeaseStatus[] = ["active"];
const INACTIVE_LEASE_STATES: LeaseStatus[] = [
  "expired",
  "terminated",
  "cancelled",
];

function pickTenantForUnit(tenants: TenantRow[]): TenantRow | null {
  if (tenants.length === 0) return null;
  // Prefer a tenant that isn't marked inactive; tie-break on most recent
  // account_opened / created_at so re-tenanted units surface the current one.
  const ranked = [...tenants].sort((a, b) => {
    const aInactive = a.status === "inactive" ? 1 : 0;
    const bInactive = b.status === "inactive" ? 1 : 0;
    if (aInactive !== bInactive) return aInactive - bInactive;
    const aKey = a.account_opened ?? a.created_at;
    const bKey = b.account_opened ?? b.created_at;
    return bKey.localeCompare(aKey);
  });
  return ranked[0] ?? null;
}

function deriveUnitState(
  tenant: TenantRow | null,
  lease: LeaseRow | null
): OnboardingUnitState {
  if (!tenant) return "vacant";
  if (!lease) return "occupied_no_lease";
  if (ACTIVE_LEASE_STATES.includes(lease.status)) return "lease_active";
  if (INACTIVE_LEASE_STATES.includes(lease.status)) return "lease_inactive";
  if (lease.status === "pending_signature") return "lease_pending_signature";
  return "lease_draft"; // draft
}

/**
 * Assemble the onboarding view for one building from already-fetched rows.
 * `tenants` and `leases` may span the whole landlord — they are filtered here.
 */
function assembleBuilding(
  building: BuildingRow,
  units: UnitRow[],
  tenants: TenantRow[],
  latestLeaseByTenant: Map<string, LeaseRow>
): OnboardingBuilding {
  const buildingUnits: OnboardingUnit[] = units
    .filter((u) => u.building_id === building.id)
    .map((unit) => {
      const unitTenants = tenants.filter((t) => t.unit_id === unit.id);
      const tenant = pickTenantForUnit(unitTenants);
      const lease = tenant
        ? latestLeaseByTenant.get(tenant.id) ?? null
        : null;
      const state = deriveUnitState(tenant, lease);
      return {
        id: unit.id,
        label: unit.label,
        unitType: unit.unit_type,
        rentKes: unit.rent_kes,
        isVacant: unit.is_vacant,
        tenantId: tenant?.id ?? null,
        tenantName: tenant?.full_name ?? null,
        leaseId: lease?.id ?? null,
        leaseStatus: lease?.status ?? null,
        state,
      };
    });

  const occupiedCount = buildingUnits.filter((u) => u.state !== "vacant").length;
  const leaseActiveCount = buildingUnits.filter(
    (u) => u.state === "lease_active"
  ).length;
  const leaseInProgressCount = buildingUnits.filter(
    (u) => u.state === "lease_draft" || u.state === "lease_pending_signature"
  ).length;
  const needsAttentionCount = buildingUnits.filter(
    (u) => u.state === "occupied_no_lease" || u.state === "lease_inactive"
  ).length;

  return {
    id: building.id,
    name: building.name,
    addressLine: building.address_line,
    city: building.city,
    region: building.region,
    rentModel: building.rent_model,
    rentKes: building.rent_kes,
    unitCount: buildingUnits.length,
    occupiedCount,
    vacantCount: buildingUnits.length - occupiedCount,
    leaseActiveCount,
    leaseInProgressCount,
    needsAttentionCount,
    completedCount: leaseActiveCount,
    isComplete:
      buildingUnits.length > 0 && leaseActiveCount === buildingUnits.length,
    units: buildingUnits,
  };
}

async function fetchUnitsForBuildings(
  client: Client,
  buildingIds: string[]
): Promise<UnitRow[]> {
  if (buildingIds.length === 0) return [];
  const { data, error } = await client
    .from("units")
    .select("*")
    .in("building_id", buildingIds)
    .order("label", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Map each tenant to their most-recent lease (leases arrive newest-first). */
function indexLatestLeaseByTenant(leases: LeaseRow[]): Map<string, LeaseRow> {
  const map = new Map<string, LeaseRow>();
  for (const lease of leases) {
    if (!map.has(lease.tenant_id)) map.set(lease.tenant_id, lease);
  }
  return map;
}

/** Whole-portfolio onboarding overview for the hub page. */
export async function getLandlordOnboardingOverview(
  client: Client,
  landlordId: string
): Promise<OnboardingOverview> {
  const [buildings, tenants, leases] = await Promise.all([
    listBuildingsForLandlord(client, landlordId),
    listTenantsForLandlord(client, landlordId),
    listLeases(client),
  ]);
  const units = await fetchUnitsForBuildings(
    client,
    buildings.map((b) => b.id)
  );
  const latestLeaseByTenant = indexLatestLeaseByTenant(
    leases.filter((l) => l.landlord_id === landlordId)
  );

  const assembled = buildings.map((b) =>
    assembleBuilding(b, units, tenants, latestLeaseByTenant)
  );

  const totals = assembled.reduce(
    (acc, b) => {
      acc.units += b.unitCount;
      acc.occupied += b.occupiedCount;
      acc.vacant += b.vacantCount;
      acc.leasesActive += b.leaseActiveCount;
      acc.leasesInProgress += b.leaseInProgressCount;
      acc.unitsNeedingTenant += b.vacantCount;
      acc.unitsNeedingLease += b.needsAttentionCount;
      if (b.unitCount === 0) acc.buildingsWithoutUnits += 1;
      return acc;
    },
    {
      buildings: assembled.length,
      units: 0,
      occupied: 0,
      vacant: 0,
      tenants: tenants.length,
      leasesActive: 0,
      leasesInProgress: 0,
      unitsNeedingTenant: 0,
      unitsNeedingLease: 0,
      buildingsWithoutUnits: 0,
    }
  );

  return { buildings: assembled, totals };
}

/** Focused onboarding view for one building (per-building page). */
export async function getBuildingOnboardingDetail(
  client: Client,
  landlordId: string,
  buildingId: string
): Promise<{ building: BuildingRow; onboarding: OnboardingBuilding } | null> {
  const { data: building, error } = await client
    .from("buildings")
    .select("*")
    .eq("id", buildingId)
    .eq("landlord_id", landlordId)
    .maybeSingle();
  if (error) throw error;
  if (!building) return null;

  const [units, tenants, leases] = await Promise.all([
    fetchUnitsForBuildings(client, [buildingId]),
    listTenantsForLandlord(client, landlordId),
    listLeases(client),
  ]);
  const latestLeaseByTenant = indexLatestLeaseByTenant(
    leases.filter((l) => l.landlord_id === landlordId)
  );

  return {
    building,
    onboarding: assembleBuilding(
      building,
      units,
      tenants,
      latestLeaseByTenant
    ),
  };
}
