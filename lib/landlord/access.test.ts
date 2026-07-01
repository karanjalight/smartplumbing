import { describe, expect, it } from "vitest";
import { resolveLandlordAccess } from "@/lib/landlord/access";

describe("resolveLandlordAccess", () => {
  it("redirects anonymous users to login", () => {
    expect(resolveLandlordAccess({ userId: null, role: null, landlordId: null }))
      .toEqual({ kind: "redirect", to: "/landlords/login" });
  });
  it("redirects a tenant (wrong role) to login", () => {
    expect(resolveLandlordAccess({ userId: "u1", role: "tenant", landlordId: null }))
      .toEqual({ kind: "redirect", to: "/landlords/login" });
  });
  it("redirects a landlord with no landlord row", () => {
    expect(resolveLandlordAccess({ userId: "u1", role: "landlord", landlordId: null }))
      .toEqual({ kind: "redirect", to: "/landlords/login" });
  });
  it("allows a landlord with a resolved landlord id", () => {
    expect(resolveLandlordAccess({ userId: "u1", role: "landlord", landlordId: "LND-9" }))
      .toEqual({ kind: "ok", landlordId: "LND-9" });
  });
});
