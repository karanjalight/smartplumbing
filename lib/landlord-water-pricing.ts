import type { BuildingListRow } from "@/lib/buildings-data";

function seedFrom(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

export type WaterPricingFields = {
  /**
   * KES charged per water unit — e.g. set 150 so **1 unit = KES 150** for prepaid / STS blocks.
   */
  pricePerUnitKes: number;
  /**
   * Short label for what “one unit” means (e.g. `1 m³`, `1000 L`, `standard STS block`).
   */
  unitDefinition: string;
  standingChargeKes: number;
  minChargeKes: number;
  vatRatePct: number;
  notes: string;
  /**
   * Legacy alias equal to `pricePerUnitKes` when present in stored overrides (older m³-only label).
   */
  baseRatePerM3Kes?: number;
};

export function defaultWaterPricing(building: BuildingListRow): WaterPricingFields {
  const s = seedFrom(building.id);
  const pricePerUnitKes = 48 + (s % 22);
  return {
    pricePerUnitKes,
    unitDefinition: "1 m³ prepaid block",
    standingChargeKes:
      building.rentModel === "whole_building" ? 3200 + (s % 800) : 400 + (s % 250),
    minChargeKes: 100,
    vatRatePct: 16,
    notes: "STS unit tariff — demo default",
    baseRatePerM3Kes: pricePerUnitKes,
  };
}

export function mergeWaterPricing(
  building: BuildingListRow,
  partial: Partial<WaterPricingFields> | undefined
): WaterPricingFields {
  const d = defaultWaterPricing(building);
  const p = partial ?? {};
  const price = Math.max(
    0,
    Math.round(p.pricePerUnitKes ?? p.baseRatePerM3Kes ?? d.pricePerUnitKes)
  );
  return {
    pricePerUnitKes: price,
    baseRatePerM3Kes: price,
    unitDefinition:
      typeof p.unitDefinition === "string" && p.unitDefinition.trim()
        ? p.unitDefinition.trim()
        : d.unitDefinition,
    standingChargeKes: Math.max(0, Math.round(p.standingChargeKes ?? d.standingChargeKes)),
    minChargeKes: Math.max(0, Math.round(p.minChargeKes ?? d.minChargeKes)),
    vatRatePct: Math.min(100, Math.max(0, Math.round(p.vatRatePct ?? d.vatRatePct))),
    notes: (p.notes ?? d.notes).trim() || "—",
  };
}
