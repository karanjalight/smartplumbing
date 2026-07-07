import { describe, expect, it } from "vitest";
import { computeCommissionSplit } from "@/lib/billing/commission";

describe("computeCommissionSplit", () => {
  it("splits gross by the fee percentage", () => {
    const s = computeCommissionSplit(15000, 10);
    expect(s).toEqual({
      grossKes: 15000, commissionPct: 10,
      commissionKes: 1500, netToLandlordKes: 13500,
    });
  });

  it("zero fee gives everything to the landlord", () => {
    const s = computeCommissionSplit(15000, 0);
    expect(s.commissionKes).toBe(0);
    expect(s.netToLandlordKes).toBe(15000);
  });

  it("100 percent fee gives everything to the platform", () => {
    const s = computeCommissionSplit(15000, 100);
    expect(s.commissionKes).toBe(15000);
    expect(s.netToLandlordKes).toBe(0);
  });

  it("rounds to cents and keeps the invariant commission + net = gross", () => {
    const s = computeCommissionSplit(1000, 7.5);
    expect(s.commissionKes).toBe(75);
    expect(s.netToLandlordKes).toBe(925);
    expect(s.commissionKes + s.netToLandlordKes).toBe(s.grossKes);
  });

  it("clamps out-of-range percentages", () => {
    expect(computeCommissionSplit(1000, 150).commissionKes).toBe(1000);
    expect(computeCommissionSplit(1000, -5).commissionKes).toBe(0);
  });
});
