import { round2 } from "@/lib/billing/money";

/** A rent payment split into platform commission and landlord net. */
export type CommissionSplit = {
  grossKes: number;
  commissionPct: number;
  commissionKes: number;    // platform (our) cut
  netToLandlordKes: number; // landlord's cut
};

/**
 * Split a gross rent payment using a building management-fee percentage.
 * Percentage is clamped to 0..100; a null/undefined fee should be passed as 0.
 */
export function computeCommissionSplit(grossKes: number, feePct: number): CommissionSplit {
  const pct = Math.min(100, Math.max(0, feePct));
  const grossRounded = round2(grossKes);
  const commissionKes = round2((grossRounded * pct) / 100);
  const netToLandlordKes = round2(grossRounded - commissionKes);
  return { grossKes: grossRounded, commissionPct: pct, commissionKes, netToLandlordKes };
}
