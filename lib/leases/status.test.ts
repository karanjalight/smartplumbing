import { describe, expect, it } from "vitest";
import {
  canGenerate, canSign, deriveExpiry, isFullySigned, requiredSigners,
} from "@/lib/leases/status";

describe("status guards", () => {
  it("allows generate only from draft or pending_signature", () => {
    expect(canGenerate("draft")).toBe(true);
    expect(canGenerate("pending_signature")).toBe(true);
    expect(canGenerate("active")).toBe(false);
    expect(canGenerate("terminated")).toBe(false);
  });

  it("allows signing only when pending_signature", () => {
    expect(canSign("pending_signature")).toBe(true);
    expect(canSign("draft")).toBe(false);
    expect(canSign("active")).toBe(false);
  });

  it("requires both tenant and landlord", () => {
    expect(requiredSigners().sort()).toEqual(["landlord", "tenant"]);
    expect(isFullySigned(["tenant"])).toBe(false);
    expect(isFullySigned(["tenant", "landlord"])).toBe(true);
  });
});

describe("deriveExpiry", () => {
  const today = new Date("2026-07-01T00:00:00Z");
  it("returns expired past end_date", () => {
    expect(deriveExpiry({ status: "active", end_date: "2026-06-30" }, today)).toBe("expired");
  });
  it("returns expiring_soon within 30 days", () => {
    expect(deriveExpiry({ status: "active", end_date: "2026-07-20" }, today)).toBe("expiring_soon");
  });
  it("returns active when far from end_date", () => {
    expect(deriveExpiry({ status: "active", end_date: "2027-01-01" }, today)).toBe("active");
  });
  it("returns active when end_date is null", () => {
    expect(deriveExpiry({ status: "active", end_date: null }, today)).toBe("active");
  });
});
