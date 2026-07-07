import { describe, expect, it } from "vitest";
import { summarizeRentCommissions, type RentCommissionRow } from "@/lib/billing/commissions-data";

function row(over: Partial<RentCommissionRow>): RentCommissionRow {
  return {
    id: "c1", paymentId: "p1", createdAtIso: "2026-05-01T00:00:00Z",
    tenantName: "Jane", buildingName: "Block A", reference: "smartone-rent-1",
    status: "completed", grossKes: 10000, commissionPct: 10,
    commissionKes: 1000, netToLandlordKes: 9000, ...over,
  };
}

describe("summarizeRentCommissions", () => {
  it("totals gross, our commission, and landlord net", () => {
    const s = summarizeRentCommissions([
      row({ grossKes: 10000, commissionKes: 1000, netToLandlordKes: 9000 }),
      row({ id: "c2", grossKes: 5000, commissionKes: 250, netToLandlordKes: 4750 }),
    ]);
    expect(s).toEqual({ count: 2, grossKes: 15000, commissionKes: 1250, netToLandlordKes: 13750 });
  });

  it("is zeroed for an empty list", () => {
    expect(summarizeRentCommissions([])).toEqual({
      count: 0, grossKes: 0, commissionKes: 0, netToLandlordKes: 0,
    });
  });
});
