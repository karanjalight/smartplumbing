import type { UnitType } from "@/lib/supabase/types";

/** Selectable house types, in display order. */
export const UNIT_TYPE_ORDER: UnitType[] = [
  "bedsitter", "studio",
  "one_bedroom", "two_bedroom", "three_bedroom", "four_bedroom",
  "five_bedroom", "six_bedroom", "seven_bedroom", "eight_bedroom",
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
};

export function unitTypeLabel(t: UnitType | null | undefined): string {
  return t ? UNIT_TYPE_LABEL[t] : "—";
}

/** Public URL for a photo stored in the (public) unit-photos bucket. */
export function unitPhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/unit-photos/${path}`;
}
