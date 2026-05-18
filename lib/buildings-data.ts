/**
 * Buildings & units — aligns with PROJECT_PROPOSAL §5.2 (multiple properties, meters, rent).
 * List rows are mock admin data; houses merge tenant-linked units where property names match.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/types";
import { resolveLandlordId } from "@/lib/landlords-data";
import { MOCK_LANDLORDS, MOCK_TENANTS } from "@/lib/tenants-data";

export type RentModel = "per_unit" | "whole_building";

/** Row from `public.buildings` (snake_case) for mapping without full typed client rows. */
export type DbBuildingRow = {
  id: string;
  code?: string | null;
  landlord_id: string;
  name: string;
  address_line: string | null;
  city: string | null;
  caretaker_name: string | null;
  caretaker_phone: string | null;
  house_count: number;
  meter_count: number;
  rent_model: RentModel;
  rent_kes: number | string;
};

export type BuildingListRow = {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  landlordId: string;
  caretakerName: string;
  caretakerPhone: string;
  houseCount: number;
  meterCount: number;
  rentModel: RentModel;
  /** per_unit: monthly rent per house; whole_building: total for all units */
  rentKes: number;
};

export type HouseUnitRow = {
  id: string;
  buildingId: string;
  label: string;
  description: string | null;
  /** Per-unit monthly rent (KES) when set; otherwise UI falls back to building default. */
  rentKes?: number | null;
  meterId: string | null;
  tenantId: string | null;
  tenantName: string | null;
};

export const MOCK_BUILDINGS: BuildingListRow[] = [
  {
    id: "BLD-001",
    name: "Sunrise Apartments",
    addressLine: "Thika Road, Ruiru",
    city: "Nairobi",
    landlordId: "LND-001",
    caretakerName: "John Mwangi",
    caretakerPhone: "+254 722 100 001",
    houseCount: 48,
    meterCount: 48,
    rentModel: "per_unit",
    rentKes: 18500,
  },
  {
    id: "BLD-002",
    name: "Riverside Court",
    addressLine: "Woodvale Grove, Westlands",
    city: "Nairobi",
    landlordId: "LND-002",
    caretakerName: "Alice Wambui",
    caretakerPhone: "+254 733 200 002",
    houseCount: 120,
    meterCount: 118,
    rentModel: "per_unit",
    rentKes: 32000,
  },
  {
    id: "BLD-003",
    name: "Green Valley Estate",
    addressLine: "Kiambu Road",
    city: "Kiambu",
    landlordId: "LND-003",
    caretakerName: "Peter Ndegwa",
    caretakerPhone: "+254 711 300 003",
    houseCount: 36,
    meterCount: 36,
    rentModel: "whole_building",
    rentKes: 540000,
  },
  {
    id: "BLD-004",
    name: "Lakeview Phase 1",
    addressLine: "Lake Nakuru view road",
    city: "Nakuru",
    landlordId: "LND-004",
    caretakerName: "Rose Chebet",
    caretakerPhone: "+254 722 400 004",
    houseCount: 6,
    meterCount: 6,
    rentModel: "per_unit",
    rentKes: 14000,
  },
  {
    id: "BLD-005",
    name: "Coastal Towers",
    addressLine: "Nyali Beach Road",
    city: "Mombasa",
    landlordId: "LND-005",
    caretakerName: "Hassan Omar",
    caretakerPhone: "+254 733 500 005",
    houseCount: 24,
    meterCount: 20,
    rentModel: "per_unit",
    rentKes: 28000,
  },
];

export function getBuildings(): BuildingListRow[] {
  return MOCK_BUILDINGS;
}

export function getBuildingsByLandlordId(landlordId: string): BuildingListRow[] {
  return MOCK_BUILDINGS.filter((b) => b.landlordId === landlordId);
}

/** Load buildings for one landlord from Supabase (id or code such as LND-001). */
export async function fetchBuildingsByLandlordId(
  client: SupabaseClient<Database>,
  landlordIdOrCode: string,
  landlord?: { company: string; full_name: string } | null,
): Promise<BuildingListRow[]> {
  const landlordId = await resolveLandlordId(client, landlordIdOrCode);
  if (!landlordId) return [];

  const { data, error } = await client
    .from("buildings")
    .select("*")
    .eq("landlord_id", landlordId)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => {
    const mapped = mapDbBuildingToListRow(row as DbBuildingRow, landlord ?? null);
    const { landlordCompany: _company, ...building } = mapped;
    return building;
  });
}

export function getBuildingById(id: string): BuildingListRow | undefined {
  return MOCK_BUILDINGS.find((b) => b.id === id);
}

function landlordCompany(landlordId: string): string {
  return MOCK_LANDLORDS.find((l) => l.id === landlordId)?.company ?? "—";
}

export function getBuildingListDisplay(
  b: BuildingListRow
): BuildingListRow & { landlordCompany: string } {
  return { ...b, landlordCompany: landlordCompany(b.landlordId) };
}

/** Map a Supabase `buildings` row + optional landlord row into list card shape. */
export function mapDbBuildingToListRow(
  b: DbBuildingRow,
  landlord?: { company: string; full_name: string } | null,
): BuildingListRow & { landlordCompany: string } {
  const rentKes =
    typeof b.rent_kes === "number"
      ? b.rent_kes
      : Number.parseFloat(String(b.rent_kes)) || 0;
  return {
    id: b.id,
    name: b.name,
    addressLine: b.address_line?.trim() ?? "",
    city: b.city?.trim() ?? "",
    landlordId: b.landlord_id,
    caretakerName: b.caretaker_name?.trim() || "—",
    caretakerPhone: b.caretaker_phone?.trim() || "—",
    houseCount: b.house_count ?? 0,
    meterCount: b.meter_count ?? 0,
    rentModel: b.rent_model,
    rentKes,
    landlordCompany:
      landlord?.company?.trim() ||
      landlord?.full_name?.trim() ||
      landlordCompany(b.landlord_id),
  };
}

export function getHousesForBuilding(building: BuildingListRow): HouseUnitRow[] {
  const linked = MOCK_TENANTS.filter((t) => t.property === building.name).map(
    (t): HouseUnitRow => ({
      id: `HS-${t.id}`,
      buildingId: building.id,
      label: t.unit,
      description: null,
      meterId: t.meterId,
      tenantId: t.id,
      tenantName: t.name,
    })
  );

  if (linked.length > 0) {
    return linked.sort((a, b) => a.label.localeCompare(b.label));
  }

  return Array.from({ length: building.houseCount }, (_, i) => ({
    id: `${building.id}-VAC-${i + 1}`,
    buildingId: building.id,
    label: `Unit ${i + 1}`,
    description: "Vacant — assign tenant when onboarding.",
    meterId: null,
    tenantId: null,
    tenantName: null,
  }));
}

export function rentSummary(b: BuildingListRow): string {
  if (b.rentModel === "per_unit") {
    return `KES ${b.rentKes.toLocaleString("en-KE")} / unit / mo`;
  }
  return `KES ${b.rentKes.toLocaleString("en-KE")} whole building / mo`;
}

/** Potential monthly rent (KES): per_unit = rent × unit count; whole_building = rent as one total. */
export function monthlyRentTotalKes(b: BuildingListRow): number {
  if (b.rentModel === "whole_building") {
    return Math.round(b.rentKes);
  }
  const n = Math.max(0, Math.floor(b.houseCount));
  return Math.round(b.rentKes * n);
}

export type BuildingDetailDbBundle = {
  building: BuildingListRow;
  landlordCompany: string;
  houses: HouseUnitRow[];
  buildingCode: string | null;
};

/**
 * Load one building, its units, tenants, and meters for the detail screen (browser or server client).
 */
export async function loadBuildingDetailFromSupabase(
  supabase: SupabaseClient<Database>,
  options: { buildingId: string; landlordId?: string | null },
): Promise<BuildingDetailDbBundle | null> {
  const { buildingId, landlordId } = options;
  let q = supabase.from("buildings").select("*").eq("id", buildingId);
  if (landlordId) {
    q = q.eq("landlord_id", landlordId);
  }
  const { data: raw, error: bErr } = await q.maybeSingle();
  if (bErr || !raw) return null;

  const bRow = raw as DbBuildingRow;
  const { data: lh } = await supabase
    .from("landlords")
    .select("company, full_name")
    .eq("id", bRow.landlord_id)
    .maybeSingle();

  const { landlordCompany, ...building } = mapDbBuildingToListRow(bRow, lh ?? null);

  const { data: units, error: uErr } = await supabase
    .from("units")
    .select("id, label, description, rent_kes, is_vacant")
    .eq("building_id", buildingId)
    .order("label", { ascending: true });

  const { data: tenants, error: tErr } = await supabase
    .from("tenants")
    .select("id, full_name, unit_id, meter_id, status")
    .eq("building_id", buildingId);

  const meterIds = new Set<string>();
  for (const t of tenants ?? []) {
    if (t.meter_id) meterIds.add(t.meter_id);
  }
  let meterNoById = new Map<string, string>();
  if (meterIds.size > 0) {
    const { data: mRows, error: mErr } = await supabase
      .from("meters")
      .select("id, meter_no")
      .in("id", [...meterIds]);
    if (!mErr && mRows) {
      meterNoById = new Map(mRows.map((m) => [m.id, m.meter_no]));
    }
  }

  const { data: unitMeters, error: umErr } = await supabase
    .from("meters")
    .select("unit_id, meter_no")
    .eq("building_id", buildingId)
    .not("unit_id", "is", null);
  const meterByUnitId = new Map<string, string>();
  if (!umErr && unitMeters) {
    for (const row of unitMeters) {
      if (row.unit_id && row.meter_no) {
        meterByUnitId.set(row.unit_id, row.meter_no);
      }
    }
  }

  const tenantList = tenants ?? [];
  const unitList = units ?? [];

  const houses: HouseUnitRow[] = unitList.map((u): HouseUnitRow => {
    const rentKes =
      u.rent_kes != null
        ? typeof u.rent_kes === "number"
          ? Math.round(u.rent_kes)
          : Math.round(Number.parseFloat(String(u.rent_kes)) || 0)
        : null;

    const candidates = tenantList.filter((t) => t.unit_id === u.id);
    const tenant =
      candidates.find((t) => t.status === "active") ??
      candidates.find((t) => t.status === "low_credit") ??
      candidates[0];

    let meterId: string | null = null;
    if (tenant?.meter_id) {
      meterId = meterNoById.get(tenant.meter_id) ?? null;
    }
    if (!meterId) {
      meterId = meterByUnitId.get(u.id) ?? null;
    }

    const desc =
      u.description?.trim() ||
      (u.is_vacant && !tenant ? "Vacant — assign tenant when onboarding." : null);

    return {
      id: u.id,
      buildingId,
      label: u.label,
      description: desc,
      rentKes: rentKes && rentKes > 0 ? rentKes : null,
      meterId,
      tenantId: tenant?.id ?? null,
      tenantName: tenant?.full_name ?? null,
    };
  });

  return {
    building,
    landlordCompany,
    houses,
    buildingCode: bRow.code?.trim() || null,
  };
}

/** Units / houses for a building (tenant create, assign-unit flows). */
export async function fetchHousesForBuilding(
  supabase: SupabaseClient<Database>,
  buildingId: string,
): Promise<HouseUnitRow[]> {
  const detail = await loadBuildingDetailFromSupabase(supabase, { buildingId });
  return detail?.houses ?? [];
}
