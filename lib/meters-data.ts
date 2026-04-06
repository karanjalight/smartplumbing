/**
 * Smart meter inventory for admin pages.
 * Aligned to PROJECT_PROPOSAL + API docs (STS water prepay, meter health, abnormal alerts).
 */

import { getBuildings, type BuildingListRow } from "@/lib/buildings-data";
import { getLandlordRows } from "@/lib/landlords-data";
import { MOCK_TENANTS, TABLE_PAGE_SIZE_OPTIONS, type TenantRow } from "@/lib/tenants-data";

export type MeterLifecycleStatus = "active" | "inactive" | "fault" | "maintenance";
export type MeterConnectivity = "online" | "offline" | "intermittent";
export type MeterModelType = "water_prepay_m3" | "water_prepay_currency" | "postpay";

export type MeterRow = {
  meterId: string;
  /** Physical / manufacturer serial for inventory (mock-derived from meter ID). */
  serialNumber: string;
  modelType: MeterModelType;
  status: MeterLifecycleStatus;
  connectivity: MeterConnectivity;
  tenantId: string | null;
  tenantName: string | null;
  landlordId: string | null;
  landlordCompany: string | null;
  buildingId: string | null;
  buildingName: string | null;
  unitLabel: string | null;
  installedOn: string;
  latestReadingM3: number | null;
  lastSyncAt: string;
  openAlerts: number;
};

type MeterMeta = Pick<
  MeterRow,
  | "status"
  | "connectivity"
  | "installedOn"
  | "latestReadingM3"
  | "lastSyncAt"
  | "openAlerts"
  | "modelType"
>;

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function pickStatus(seed: number): MeterLifecycleStatus {
  const n = seed % 100;
  if (n < 68) return "active";
  if (n < 83) return "inactive";
  if (n < 94) return "maintenance";
  return "fault";
}

function pickConnectivity(seed: number): MeterConnectivity {
  const n = seed % 100;
  if (n < 70) return "online";
  if (n < 90) return "intermittent";
  return "offline";
}

function pickModelType(seed: number): MeterModelType {
  const n = seed % 100;
  if (n < 76) return "water_prepay_m3";
  if (n < 92) return "water_prepay_currency";
  return "postpay";
}

function deterministicMeta(meterId: string): MeterMeta {
  const seed = hashSeed(meterId);
  const status = pickStatus(seed);
  const connectivity = pickConnectivity(seed >>> 1);
  const modelType = pickModelType(seed >>> 2);
  const openAlerts =
    status === "fault" ? 3 + (seed % 2) : status === "maintenance" ? 1 : connectivity === "offline" ? 2 : seed % 2;

  const month = (seed % 9) + 1;
  const day = (seed % 27) + 1;
  const reading = status === "inactive" ? null : Number((((seed % 8200) + 160) / 10).toFixed(1));

  return {
    status,
    connectivity,
    modelType,
    installedOn: `2025-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    latestReadingM3: reading,
    lastSyncAt: `2026-03-${String(((seed % 20) + 1)).padStart(2, "0")} ${String((seed % 23)).padStart(2, "0")}:${String((seed % 59)).padStart(2, "0")}`,
    openAlerts,
  };
}

const META_OVERRIDES: Record<string, Partial<MeterMeta>> = {
  "0159000000640": {
    status: "active",
    connectivity: "online",
    modelType: "water_prepay_m3",
    latestReadingM3: 42.8,
    openAlerts: 0,
  },
  "70000003130": {
    status: "active",
    connectivity: "intermittent",
    modelType: "water_prepay_currency",
    latestReadingM3: 118.2,
    openAlerts: 1,
  },
  "0159000000891": {
    status: "maintenance",
    connectivity: "offline",
    modelType: "water_prepay_m3",
    latestReadingM3: 63.9,
    openAlerts: 2,
  },
};

export function meterTypeLabel(modelType: MeterModelType): string {
  if (modelType === "water_prepay_m3") return "Prepay water (m3)";
  if (modelType === "water_prepay_currency") return "Prepay water (currency)";
  return "Postpay";
}

/** Build a meter row from tenant + building directory (used by admin list + landlord merged views). */
export function buildMeterRowFromTenant(
  tenant: TenantRow,
  buildings: BuildingListRow[],
  landlordCompany: string | null
): MeterRow {
  const building = buildings.find((b) => b.name === tenant.property);
  const generated = deterministicMeta(tenant.meterId);
  const meta = { ...generated, ...(META_OVERRIDES[tenant.meterId] ?? {}) };

  return {
    meterId: tenant.meterId,
    serialNumber: `SN-${tenant.meterId.replace(/\D/g, "").slice(-8).padStart(8, "0")}`,
    modelType: meta.modelType!,
    status: meta.status!,
    connectivity: meta.connectivity!,
    tenantId: tenant.id,
    tenantName: tenant.name,
    landlordId: tenant.landlordId,
    landlordCompany,
    buildingId: building?.id ?? null,
    buildingName: tenant.property,
    unitLabel: tenant.unit,
    installedOn: meta.installedOn!,
    latestReadingM3: meta.latestReadingM3 ?? null,
    lastSyncAt: meta.lastSyncAt!,
    openAlerts: meta.openAlerts ?? 0,
  };
}

export function getMeterRows(): MeterRow[] {
  const buildings = getBuildings();
  const landlords = getLandlordRows();

  return MOCK_TENANTS.map((tenant) => {
    const landlord = landlords.find((l) => l.id === tenant.landlordId);
    return buildMeterRowFromTenant(tenant, buildings, landlord?.company ?? null);
  });
}

export { TABLE_PAGE_SIZE_OPTIONS };
