/**
 * Buildings & units — aligns with PROJECT_PROPOSAL §5.2 (multiple properties, meters, rent).
 * List rows are mock admin data; houses merge tenant-linked units where property names match.
 */

import { MOCK_LANDLORDS, MOCK_TENANTS } from "@/lib/tenants-data";

export type RentModel = "per_unit" | "whole_building";

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
