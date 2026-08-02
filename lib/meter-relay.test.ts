import { describe, expect, it } from "vitest";

import { authorizeRelayAction } from "@/lib/meter-relay";

describe("authorizeRelayAction", () => {
  it("allows admin regardless of ownership", () => {
    const result = authorizeRelayAction(
      { kind: "admin" },
      { landlordId: "landlord-z", buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: true });
  });

  it("allows a landlord whose id matches the meter's landlord_id", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-a" },
      { landlordId: "landlord-a", buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a landlord whose id does not match the meter's landlord_id", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-z" },
      { landlordId: "landlord-a", buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: false, error: "This meter is not in your portfolio." });
  });

  it("falls back to the building's landlord when the meter has no direct landlord_id", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-a" },
      { landlordId: null, buildingLandlordId: "landlord-a" }
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects when neither the meter nor its building matches the landlord", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-z" },
      { landlordId: null, buildingLandlordId: "landlord-a" }
    );
    expect(result).toEqual({ ok: false, error: "This meter is not in your portfolio." });
  });

  it("allows a landlord when the meter has no owner recorded at all", () => {
    const result = authorizeRelayAction(
      { kind: "landlord", landlordId: "landlord-a" },
      { landlordId: null, buildingLandlordId: null }
    );
    expect(result).toEqual({ ok: true });
  });
});
