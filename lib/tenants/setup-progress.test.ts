import { describe, expect, it } from "vitest";

import {
  computeTenantSetupProgress,
  type SetupProgressInput,
} from "@/lib/tenants/setup-progress";

function base(overrides: Partial<SetupProgressInput> = {}): SetupProgressInput {
  return {
    fullName: null,
    phone: null,
    email: null,
    unitId: null,
    hasWaterMeter: false,
    hasElectricityMeter: false,
    waterDepositRequired: false,
    waterDepositAmount: null,
    electricityDepositRequired: false,
    electricityDepositAmount: null,
    leaseStatus: "none",
    tenantSignedLease: false,
    ...overrides,
  };
}

describe("computeTenantSetupProgress", () => {
  it("is 0% for a fresh tenant with nothing set", () => {
    const p = computeTenantSetupProgress(base());
    expect(p.total).toBe(4);
    expect(p.completed).toBe(0);
    expect(p.percent).toBe(0);
    expect(p.steps.map((s) => s.key)).toEqual([
      "profile",
      "property_meter",
      "deposits",
      "lease",
    ]);
  });

  it("marks profile done with name + phone", () => {
    const p = computeTenantSetupProgress(base({ fullName: "Jane", phone: "0700" }));
    expect(p.steps.find((s) => s.key === "profile")?.done).toBe(true);
    expect(p.completed).toBe(1);
    expect(p.percent).toBe(25);
  });

  it("marks profile done with name + email only", () => {
    const p = computeTenantSetupProgress(base({ fullName: "Jane", email: "a@b.c" }));
    expect(p.steps.find((s) => s.key === "profile")?.done).toBe(true);
  });

  it("requires both unit and a meter for property_meter", () => {
    expect(
      computeTenantSetupProgress(base({ unitId: "u1" })).steps.find(
        (s) => s.key === "property_meter",
      )?.done,
    ).toBe(false);
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", hasWaterMeter: true }),
      ).steps.find((s) => s.key === "property_meter")?.done,
    ).toBe(true);
  });

  it("deposits step is false when no meter is assigned", () => {
    expect(
      computeTenantSetupProgress(base()).steps.find((s) => s.key === "deposits")
        ?.done,
    ).toBe(false);
  });

  it("deposits done when assigned meter is not required", () => {
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: false }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("deposits not done when required but amount missing or non-positive", () => {
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: true, waterDepositAmount: null }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: true, waterDepositAmount: 0 }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("deposits done when required with a positive amount", () => {
    expect(
      computeTenantSetupProgress(
        base({ hasWaterMeter: true, waterDepositRequired: true, waterDepositAmount: 5000 }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("requires every assigned meter to be configured", () => {
    // water not required (ok) but electricity required with no amount (not ok)
    expect(
      computeTenantSetupProgress(
        base({
          hasWaterMeter: true,
          hasElectricityMeter: true,
          electricityDepositRequired: true,
          electricityDepositAmount: null,
        }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("marks lease done when active or tenant-signed, not when none", () => {
    expect(
      computeTenantSetupProgress(base({ leaseStatus: "active" })).steps.find(
        (s) => s.key === "lease",
      )?.done,
    ).toBe(true);
    expect(
      computeTenantSetupProgress(
        base({ leaseStatus: "pending_signature", tenantSignedLease: true }),
      ).steps.find((s) => s.key === "lease")?.done,
    ).toBe(true);
    expect(
      computeTenantSetupProgress(base({ leaseStatus: "none" })).steps.find(
        (s) => s.key === "lease",
      )?.done,
    ).toBe(false);
  });

  it("is 100% when all four steps are done", () => {
    const p = computeTenantSetupProgress(
      base({
        fullName: "Jane",
        phone: "0700",
        unitId: "u1",
        hasWaterMeter: true,
        waterDepositRequired: true,
        waterDepositAmount: 5000,
        leaseStatus: "active",
      }),
    );
    expect(p.completed).toBe(4);
    expect(p.percent).toBe(100);
  });
});
