import type { UnitType } from "@/lib/supabase/types";

/** Selectable unit types, in display order (residential first, then commercial). */
export const UNIT_TYPE_ORDER: UnitType[] = [
  "bedsitter", "studio",
  "one_bedroom", "two_bedroom", "three_bedroom", "four_bedroom",
  "five_bedroom", "six_bedroom", "seven_bedroom", "eight_bedroom",
  "commercial", "office", "shop", "warehouse", "parking", "other",
];

export const UNIT_TYPE_LABEL: Record<UnitType, string> = {
  bedsitter: "Bedsitter",
  studio: "Studio",
  one_bedroom: "1 Bedroom",
  two_bedroom: "2 Bedroom",
  three_bedroom: "3 Bedroom",
  four_bedroom: "4 Bedroom",
  five_bedroom: "5 Bedroom",
  six_bedroom: "6 Bedroom",
  seven_bedroom: "7 Bedroom",
  eight_bedroom: "8 Bedroom",
  commercial: "Commercial",
  office: "Office",
  shop: "Shop",
  warehouse: "Warehouse",
  parking: "Parking",
  other: "Other",
};

export type UnitCategory = "residential" | "commercial";

/** High-level grouping bucket for each unit type. */
export const UNIT_TYPE_CATEGORY: Record<UnitType, UnitCategory> = {
  bedsitter: "residential",
  studio: "residential",
  one_bedroom: "residential",
  two_bedroom: "residential",
  three_bedroom: "residential",
  four_bedroom: "residential",
  five_bedroom: "residential",
  six_bedroom: "residential",
  seven_bedroom: "residential",
  eight_bedroom: "residential",
  commercial: "commercial",
  office: "commercial",
  shop: "commercial",
  warehouse: "commercial",
  parking: "commercial",
  other: "commercial",
};

export const UNIT_CATEGORY_LABEL: Record<UnitCategory, string> = {
  residential: "Residential",
  commercial: "Commercial & other",
};

export function unitTypeCategory(t: UnitType | null | undefined): UnitCategory | null {
  return t ? UNIT_TYPE_CATEGORY[t] : null;
}

export function unitTypeLabel(t: UnitType | null | undefined): string {
  return t ? UNIT_TYPE_LABEL[t] : "—";
}

/** Public URL for a photo stored in the (public) unit-photos bucket. */
export function unitPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/unit-photos/${path}`;
}
