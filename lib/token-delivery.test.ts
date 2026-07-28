import { describe, expect, it } from "vitest";

import { authorizeDelivery, type DeliveryPurchaseContext } from "@/lib/token-delivery";

function ctx(overrides: Partial<DeliveryPurchaseContext> = {}): DeliveryPurchaseContext {
  return {
    id: "purchase-1",
    utility: "electricity",
    deliveryStatus: "pending",
    tenantId: "tenant-a",
    tenantLandlordId: "landlord-a",
    meterLandlordId: "landlord-a",
    ...overrides,
  };
}

describe("authorizeDelivery", () => {
  it("rejects a water purchase regardless of actor", () => {
    const result = authorizeDelivery({ kind: "admin" }, ctx({ utility: "water" }));
    expect(result).toEqual({
      ok: false,
      error: "Remote token delivery is only available for electricity purchases.",
    });
  });

  it("rejects an already-uploaded purchase and reports the current status", () => {
    const result = authorizeDelivery({ kind: "admin" }, ctx({ deliveryStatus: "uploaded" }));
    expect(result).toEqual({
      ok: false,
      error: "This token has already been delivered to the meter.",
      currentStatus: "uploaded",
    });
  });

  it("rejects an already-cancelled purchase and reports the current status", () => {
    const result = authorizeDelivery({ kind: "admin" }, ctx({ deliveryStatus: "cancelled" }));
    expect(result).toEqual({
      ok: false,
      error: "This purchase has already been cancelled.",
      currentStatus: "cancelled",
    });
  });

  it("allows admin on a pending electricity purchase", () => {
    expect(authorizeDelivery({ kind: "admin" }, ctx())).toEqual({ ok: true });
  });

  it("allows a tenant acting on their own purchase", () => {
    const result = authorizeDelivery({ kind: "tenant", tenantId: "tenant-a" }, ctx());
    expect(result).toEqual({ ok: true });
  });

  it("rejects a tenant acting on someone else's purchase", () => {
    const result = authorizeDelivery({ kind: "tenant", tenantId: "tenant-b" }, ctx());
    expect(result).toEqual({ ok: false, error: "You can only act on your own purchases." });
  });

  it("allows a landlord whose id matches the purchase's tenant landlord", () => {
    const result = authorizeDelivery({ kind: "landlord", landlordId: "landlord-a" }, ctx());
    expect(result).toEqual({ ok: true });
  });

  it("rejects a landlord whose id does not match the tenant landlord", () => {
    const result = authorizeDelivery({ kind: "landlord", landlordId: "landlord-z" }, ctx());
    expect(result).toEqual({ ok: false, error: "This purchase is not in your portfolio." });
  });

  it("falls back to the meter's landlord when the purchase has no tenant landlord", () => {
    const result = authorizeDelivery(
      { kind: "landlord", landlordId: "landlord-a" },
      ctx({ tenantLandlordId: null, meterLandlordId: "landlord-a" })
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a landlord when neither tenant nor meter landlord matches", () => {
    const result = authorizeDelivery(
      { kind: "landlord", landlordId: "landlord-z" },
      ctx({ tenantLandlordId: null, meterLandlordId: "landlord-a" })
    );
    expect(result).toEqual({ ok: false, error: "This purchase is not in your portfolio." });
  });

  it("allows a landlord when neither tenant nor meter has a landlord recorded", () => {
    const result = authorizeDelivery(
      { kind: "landlord", landlordId: "landlord-a" },
      ctx({ tenantLandlordId: null, meterLandlordId: null })
    );
    expect(result).toEqual({ ok: true });
  });
});
