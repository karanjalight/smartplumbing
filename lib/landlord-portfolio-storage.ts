/**
 * Client-side CRUD for landlord portal — merges mock seed data with localStorage.
 */

import {
  getHousesForBuilding,
  MOCK_BUILDINGS,
  type BuildingListRow,
  type HouseUnitRow,
  type RentModel,
} from "@/lib/buildings-data";
import type { WaterPricingFields } from "@/lib/landlord-water-pricing";
import { MOCK_TENANTS, type TenantRow } from "@/lib/tenants-data";

const STORAGE_KEY = "smartone_landlord_portfolio_v1";

export type PortfolioStore = {
  tenantOverrides: Record<string, TenantRow>;
  tenantRemovedIds: string[];
  buildingOverrides: Record<string, BuildingListRow>;
  buildingRemovedIds: string[];
  /** Partial overrides per building id — merged with `defaultWaterPricing`. */
  waterPricingOverrides: Record<string, Partial<WaterPricingFields>>;
  /** Landlord-created units per building id (merged with seed `getHousesForBuilding`). */
  portfolioHouseUnits: Record<string, HouseUnitRow[]>;
};

function emptyStore(): PortfolioStore {
  return {
    tenantOverrides: {},
    tenantRemovedIds: [],
    buildingOverrides: {},
    buildingRemovedIds: [],
    waterPricingOverrides: {},
    portfolioHouseUnits: {},
  };
}

export function readStore(): PortfolioStore {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<PortfolioStore>;
    return {
      ...emptyStore(),
      ...parsed,
      tenantOverrides: parsed.tenantOverrides ?? {},
      buildingOverrides: parsed.buildingOverrides ?? {},
      tenantRemovedIds: parsed.tenantRemovedIds ?? [],
      buildingRemovedIds: parsed.buildingRemovedIds ?? [],
      waterPricingOverrides: parsed.waterPricingOverrides ?? {},
      portfolioHouseUnits: parsed.portfolioHouseUnits ?? {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(next: PortfolioStore) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("smartone-portfolio-change"));
}

export function subscribePortfolio(cb: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  const onCustom = () => cb();
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
    window.addEventListener("smartone-portfolio-change", onCustom);
  }
  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("smartone-portfolio-change", onCustom);
    }
  };
}

export function getLandlordTenantsMerged(landlordId: string, store: PortfolioStore): TenantRow[] {
  const out: TenantRow[] = [];
  const seen = new Set<string>();

  for (const t of MOCK_TENANTS) {
    if (t.landlordId !== landlordId) continue;
    if (store.tenantRemovedIds.includes(t.id)) continue;
    out.push(store.tenantOverrides[t.id] ?? t);
    seen.add(t.id);
  }

  for (const t of Object.values(store.tenantOverrides)) {
    if (t.landlordId !== landlordId) continue;
    if (seen.has(t.id)) continue;
    out.push(t);
    seen.add(t.id);
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function getLandlordBuildingsMerged(landlordId: string, store: PortfolioStore): BuildingListRow[] {
  const out: BuildingListRow[] = [];
  const seen = new Set<string>();

  for (const b of MOCK_BUILDINGS) {
    if (b.landlordId !== landlordId) continue;
    if (store.buildingRemovedIds.includes(b.id)) continue;
    out.push(store.buildingOverrides[b.id] ?? b);
    seen.add(b.id);
  }

  for (const b of Object.values(store.buildingOverrides)) {
    if (b.landlordId !== landlordId) continue;
    if (seen.has(b.id)) continue;
    out.push(b);
    seen.add(b.id);
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function getLandlordBuildingMerged(
  landlordId: string,
  buildingId: string,
  store: PortfolioStore
): BuildingListRow | undefined {
  return getLandlordBuildingsMerged(landlordId, store).find((b) => b.id === buildingId);
}

/** Seed houses + landlord-added units for this building. */
export function getMergedHousesForBuilding(building: BuildingListRow, store: PortfolioStore): HouseUnitRow[] {
  const base = getHousesForBuilding(building);
  const extras = store.portfolioHouseUnits[building.id] ?? [];
  const byId = new Map<string, HouseUnitRow>();
  for (const h of base) {
    byId.set(h.id, h);
  }
  for (const h of extras) {
    byId.set(h.id, h);
  }
  return Array.from(byId.values()).sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { numeric: true })
  );
}

/**
 * Applies tenant ↔ house links from landlord portfolio (`houseUnitId` on each tenant).
 * When set, overrides seed / portfolio house occupant for that unit row.
 */
export function getMergedHousesForBuildingWithTenantAssignments(
  building: BuildingListRow,
  store: PortfolioStore,
  landlordTenants: TenantRow[]
): HouseUnitRow[] {
  const base = getMergedHousesForBuilding(building, store);
  return base.map((h) => {
    const assigned = landlordTenants.find(
      (t) => t.landlordId === building.landlordId && t.houseUnitId === h.id
    );
    if (!assigned) return h;
    return {
      ...h,
      tenantId: assigned.id,
      tenantName: assigned.name,
      meterId:
        assigned.meterId && assigned.meterId !== "—" ? assigned.meterId : h.meterId,
    };
  });
}

export function newHouseUnitId() {
  return `HS-L-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Demo STS-style serial when the user enables meter but leaves the field blank. */
export function newPlaceholderMeterSerial() {
  const part = String(Date.now() % 1_000_000_000_000).padStart(12, "0");
  return `0159${part.slice(0, 10)}`;
}

/**
 * Append a landlord-created unit and bump building unit / meter counts on the merged row.
 */
export function addPortfolioHouseAndUpdateBuilding(
  landlordId: string,
  buildingId: string,
  house: HouseUnitRow,
  incrementMeterCount: boolean
) {
  const s = readStore();
  const b = getLandlordBuildingMerged(landlordId, buildingId, s);
  if (!b) return;

  const prev = s.portfolioHouseUnits[buildingId] ?? [];
  s.portfolioHouseUnits[buildingId] = [...prev, house];
  s.buildingOverrides[buildingId] = {
    ...b,
    houseCount: b.houseCount + 1,
    meterCount: b.meterCount + (incrementMeterCount ? 1 : 0),
  };
  writeStore(s);
}

export function updateLandlordBuildingCaretaker(
  landlordId: string,
  buildingId: string,
  caretakerName: string,
  caretakerPhone: string
) {
  const s = readStore();
  const b = getLandlordBuildingMerged(landlordId, buildingId, s);
  if (!b) return;
  s.buildingOverrides[buildingId] = {
    ...b,
    caretakerName: caretakerName.trim(),
    caretakerPhone: caretakerPhone.trim(),
  };
  writeStore(s);
}

export function upsertLandlordTenant(tenant: TenantRow) {
  const s = readStore();
  s.tenantOverrides[tenant.id] = tenant;
  s.tenantRemovedIds = s.tenantRemovedIds.filter((id) => id !== tenant.id);
  writeStore(s);
}

export function deleteLandlordTenant(tenantId: string) {
  const s = readStore();
  if (MOCK_TENANTS.some((t) => t.id === tenantId)) {
    if (!s.tenantRemovedIds.includes(tenantId)) {
      s.tenantRemovedIds = [...s.tenantRemovedIds, tenantId];
    }
  }
  delete s.tenantOverrides[tenantId];
  writeStore(s);
}

export function upsertLandlordBuilding(row: BuildingListRow) {
  const s = readStore();
  s.buildingOverrides[row.id] = row;
  s.buildingRemovedIds = s.buildingRemovedIds.filter((id) => id !== row.id);
  writeStore(s);
}

export function deleteLandlordBuilding(buildingId: string) {
  const s = readStore();
  if (MOCK_BUILDINGS.some((b) => b.id === buildingId)) {
    if (!s.buildingRemovedIds.includes(buildingId)) {
      s.buildingRemovedIds = [...s.buildingRemovedIds, buildingId];
    }
  }
  delete s.buildingOverrides[buildingId];
  delete s.waterPricingOverrides[buildingId];
  delete s.portfolioHouseUnits[buildingId];
  writeStore(s);
}

export function upsertWaterPricingPartial(
  buildingId: string,
  partial: Partial<WaterPricingFields>
) {
  const s = readStore();
  s.waterPricingOverrides[buildingId] = {
    ...(s.waterPricingOverrides[buildingId] ?? {}),
    ...partial,
  };
  writeStore(s);
}

/** Clear custom pricing for a building (revert to seeded defaults). */
export function removeWaterPricingOverride(buildingId: string) {
  const s = readStore();
  delete s.waterPricingOverrides[buildingId];
  writeStore(s);
}

export function newTenantId() {
  return `TNT-L-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function newBuildingId() {
  return `BLD-L-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultTenantForLandlord(landlordId: string, property: string): TenantRow {
  return {
    id: newTenantId(),
    name: "",
    phone: "",
    meterId: "",
    property,
    unit: "",
    landlordId,
    balanceKes: 0,
    lastTokenDate: "—",
    lastTokenPreview: "—",
    status: "active",
    buildingId: null,
    houseUnitId: null,
  };
}

export function defaultBuildingForLandlord(landlordId: string): BuildingListRow {
  return {
    id: newBuildingId(),
    name: "",
    addressLine: "",
    city: "Nairobi",
    landlordId,
    caretakerName: "",
    caretakerPhone: "",
    houseCount: 1,
    meterCount: 1,
    rentModel: "per_unit",
    rentKes: 15000,
  };
}

export type { HouseUnitRow, RentModel };
