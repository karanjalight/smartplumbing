/**
 * Smart meter inventory for admin pages.
 * Aligned to PROJECT_PROPOSAL + API docs (STS water prepay, meter health, abnormal alerts).
 */

import { getBuildings, type BuildingListRow } from "@/lib/buildings-data";
import { getLandlordRows } from "@/lib/landlords-data";
import { MOCK_TENANTS, TABLE_PAGE_SIZE_OPTIONS, type TenantRow } from "@/lib/tenants-data";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { listMeterDirectory } from "@/lib/supabase/queries";

export type MeterLifecycleStatus = "active" | "inactive" | "fault" | "maintenance";
export type MeterConnectivity = "online" | "offline" | "intermittent" | "unknown";
export type MeterRelayState = "connected" | "disconnected" | "unknown";
export type MeterModelType =
  | "water_prepay_m3"
  | "water_prepay_currency"
  | "postpay"
  | "electricity_prepay_kwh"
  | "electricity_prepay_currency";

export type MeterDirectoryDbRow = Database["public"]["Views"]["meter_directory"]["Row"];

export type MeterRow = {
  meterId: string;
  /** Vendor / manufacturer name from onboarding. */
  supplier: string;
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
  relayState: MeterRelayState;
  relayStateAt: string | null;
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
  if (modelType === "electricity_prepay_kwh") return "Prepay electricity (kWh)";
  if (modelType === "electricity_prepay_currency") return "Prepay electricity (currency)";
  return "Postpay";
}

export type MeterUtility = "water" | "electricity";

/** Water vs. electricity, derived from model_type (postpay buckets as water — no electricity postpay type exists today). */
export function utilityOfModelType(modelType: MeterModelType): MeterUtility {
  return modelType.startsWith("electricity_") ? "electricity" : "water";
}

export function isElectricityMeter(row: { modelType: MeterModelType }): boolean {
  return utilityOfModelType(row.modelType) === "electricity";
}

export function isWaterMeter(row: { modelType: MeterModelType }): boolean {
  return utilityOfModelType(row.modelType) === "water";
}

/** Map `meter_directory` view row to the dashboard `MeterRow` shape. */
export function mapMeterDirectoryToUiRow(row: MeterDirectoryDbRow): MeterRow {
  const meterNo = row.meter_no ?? "";
  const connectivity = (row.connectivity_status ?? "unknown") as MeterConnectivity;
  const installed = row.installed_on?.trim();
  const lastSync = row.last_sync_at
    ? new Date(row.last_sync_at).toLocaleString("en-KE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "Never";
  const relayStateAt = row.relay_state_at
    ? new Date(row.relay_state_at).toLocaleString("en-KE", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;

  return {
    meterId: meterNo,
    supplier: row.supplier?.trim() || "—",
    modelType: row.model_type as MeterModelType,
    status: row.lifecycle_status as MeterLifecycleStatus,
    connectivity,
    tenantId: row.tenant_id,
    tenantName: row.tenant_name,
    landlordId: row.landlord_id,
    landlordCompany: row.landlord_company,
    buildingId: row.building_id,
    buildingName: row.building_name,
    unitLabel: row.unit_label,
    installedOn: installed && installed.length > 0 ? installed : "—",
    latestReadingM3: row.latest_reading_m3 != null ? Number(row.latest_reading_m3) : null,
    lastSyncAt: lastSync,
    openAlerts: row.open_alerts ?? 0,
    relayState: (row.relay_state ?? "unknown") as MeterRelayState,
    relayStateAt,
  };
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
    supplier: "—",
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
    relayState: "unknown",
    relayStateAt: null,
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

/** Spare meters in inventory (not linked to a tenant in mock seed). */
const LOOSE_INVENTORY_METERS: MeterRow[] = [
  {
    meterId: "0159000000991",
    supplier: "LONGi",
    modelType: "water_prepay_m3",
    status: "active",
    connectivity: "online",
    tenantId: null,
    tenantName: null,
    landlordId: null,
    landlordCompany: null,
    buildingId: null,
    buildingName: null,
    unitLabel: null,
    installedOn: "2026-02-10",
    latestReadingM3: 0,
    lastSyncAt: "2026-05-10 09:15",
    openAlerts: 0,
    relayState: "unknown",
    relayStateAt: null,
  },
  {
    meterId: "0159000000992",
    supplier: "Kamstrup",
    modelType: "water_prepay_m3",
    status: "active",
    connectivity: "online",
    tenantId: null,
    tenantName: null,
    landlordId: null,
    landlordCompany: null,
    buildingId: null,
    buildingName: null,
    unitLabel: null,
    installedOn: "2026-02-18",
    latestReadingM3: 0,
    lastSyncAt: "2026-05-11 11:40",
    openAlerts: 0,
    relayState: "unknown",
    relayStateAt: null,
  },
  {
    meterId: "70000009993",
    supplier: "Sensus",
    modelType: "water_prepay_currency",
    status: "inactive",
    connectivity: "offline",
    tenantId: null,
    tenantName: null,
    landlordId: null,
    landlordCompany: null,
    buildingId: null,
    buildingName: null,
    unitLabel: null,
    installedOn: "2026-03-01",
    latestReadingM3: null,
    lastSyncAt: "2026-04-20 07:00",
    openAlerts: 0,
    relayState: "unknown",
    relayStateAt: null,
  },
];

function mergeMeterRowsById(rows: MeterRow[]): MeterRow[] {
  const m = new Map<string, MeterRow>();
  for (const r of rows) {
    m.set(r.meterId, r);
  }
  return Array.from(m.values()).sort((a, b) => a.meterId.localeCompare(b.meterId));
}

/** Admin tenant form: onboarded meters + spare inventory (deduped by meter ID). */
export function getAdminMetersForTenantPicker(): MeterRow[] {
  return mergeMeterRowsById([...getMeterRows(), ...LOOSE_INVENTORY_METERS]);
}

/** All meters for manual token issuance picker (includes assigned meters). */
export function getMetersForManualTokenPicker(): MeterRow[] {
  return mergeMeterRowsById([...getMeterRows(), ...LOOSE_INVENTORY_METERS]);
}

/** Admin meters list from Supabase `meter_directory`. */
export async function fetchMeterRows(
  client: SupabaseClient<Database>,
): Promise<MeterRow[]> {
  const directory = await listMeterDirectory(client);
  return directory.map(mapMeterDirectoryToUiRow);
}

/** Landlord portal: meters owned by landlord or installed on their buildings. */
export async function fetchMeterRowsForLandlord(
  client: SupabaseClient<Database>,
  landlordId: string,
): Promise<MeterRow[]> {
  const { data: buildings, error: bErr } = await client
    .from("buildings")
    .select("id")
    .eq("landlord_id", landlordId);
  if (bErr) throw bErr;

  const buildingIds = new Set((buildings ?? []).map((b) => b.id));
  const directory = await listMeterDirectory(client);

  return directory
    .filter(
      (row) =>
        row.landlord_id === landlordId ||
        (row.building_id != null && buildingIds.has(row.building_id)),
    )
    .map(mapMeterDirectoryToUiRow)
    .sort((a, b) => a.meterId.localeCompare(b.meterId));
}

/** Meters for admin create-tenant picker (Supabase `meter_directory`). */
export async function fetchAdminMetersForTenantPicker(
  client: SupabaseClient<Database>,
  landlordId?: string | null,
): Promise<MeterRow[]> {
  const directory = await listMeterDirectory(client);
  let rows = directory.map(mapMeterDirectoryToUiRow);

  if (landlordId) {
    rows = rows.filter(
      (m) =>
        !m.tenantId &&
        (m.landlordId === null || m.landlordId === landlordId),
    );
  } else {
    rows = rows.filter((m) => !m.tenantId);
  }

  return rows.sort((a, b) => a.meterId.localeCompare(b.meterId));
}

export function formatMeterPickerLabel(row: MeterRow): string {
  const site = row.buildingName?.trim() || "Unassigned site";
  const assign = row.tenantName?.trim()
    ? `In use: ${row.tenantName}`
    : "Available";
  return `${row.meterId} · ${site} · ${assign}`;
}

export { TABLE_PAGE_SIZE_OPTIONS };
