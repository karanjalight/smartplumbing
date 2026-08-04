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
    paysWaterDeposit: true,
    paysElectricityDeposit: true,
    paysRentDeposit: true,
    waterMeterDepositKes: null,
    electricityMeterDepositKes: null,
    rentDepositKes: null,
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

  it("deposits step is false with no unit assigned", () => {
    expect(
      computeTenantSetupProgress(base({ unitId: null })).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("deposits done when a paid rent deposit has a price and no meters", () => {
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", paysRentDeposit: true, rentDepositKes: 20000 }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("deposits not done when a paid deposit has no unit price", () => {
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", paysRentDeposit: true, rentDepositKes: null }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(false);
  });

  it("deposits done when the unpriced deposit is waived", () => {
    expect(
      computeTenantSetupProgress(
        base({ unitId: "u1", paysRentDeposit: false, rentDepositKes: null }),
      ).steps.find((s) => s.key === "deposits")?.done,
    ).toBe(true);
  });

  it("requires every assigned meter's paid deposit to be priced", () => {
    expect(
      computeTenantSetupProgress(
        base({
          unitId: "u1",
          hasWaterMeter: true,
          hasElectricityMeter: true,
          paysWaterDeposit: true,
          waterMeterDepositKes: 5000,
          paysElectricityDeposit: true,
          electricityMeterDepositKes: null,
          paysRentDeposit: false,
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
        waterMeterDepositKes: 5000,
        paysRentDeposit: true,
        rentDepositKes: 20000,
        leaseStatus: "active",
      }),
    );
    expect(p.completed).toBe(4);
    expect(p.percent).toBe(100);
  });
});
