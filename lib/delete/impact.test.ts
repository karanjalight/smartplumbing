import { describe, expect, it } from "vitest";

import {
  buildBuildingImpact,
  buildLandlordImpact,
  buildLeaseImpact,
  buildMeterImpact,
  buildPayoutImpact,
  buildStaffImpact,
  buildTenantImpact,
  buildUnitImpact,
} from "@/lib/delete/impact";

describe("impact builders", () => {
  it("drops zero-count lines", () => {
    expect(buildBuildingImpact({ units: 0, meters: 0, tenants: 0 })).toEqual([]);
  });

  it("labels building dependents with correct severities", () => {
    expect(buildBuildingImpact({ units: 3, meters: 2, tenants: 1 })).toEqual([
      { label: "Houses/units deleted", count: 3, severity: "delete" },
      { label: "Meters unassigned", count: 2, severity: "unassign" },
      { label: "Tenants unassigned from this building", count: 1, severity: "unassign" },
    ]);
  });

  it("marks tenant login + leases as destructive, payments/tokens as unassign", () => {
    expect(
      buildTenantImpact({ unitFreed: 1, authUser: 1, leases: 2, payments: 5, tokens: 4 }),
    ).toEqual([
      { label: "Unit freed (marked vacant)", count: 1, severity: "unassign" },
      { label: "Login account removed", count: 1, severity: "delete" },
      { label: "Leases deleted", count: 2, severity: "delete" },
      { label: "Payments unlinked (kept for records)", count: 5, severity: "unassign" },
      { label: "Token purchases unlinked (kept for records)", count: 4, severity: "unassign" },
    ]);
  });

  it("landlord impact leads with destructive portfolio loss", () => {
    expect(
      buildLandlordImpact({ buildings: 2, units: 6, tenants: 3, meters: 4, payouts: 1 }),
    ).toEqual([
      { label: "Tenants deleted (incl. their logins)", count: 3, severity: "delete" },
      { label: "Buildings deleted", count: 2, severity: "delete" },
      { label: "Houses/units deleted", count: 6, severity: "delete" },
      { label: "Payouts deleted", count: 1, severity: "delete" },
      { label: "Meters unassigned", count: 4, severity: "unassign" },
    ]);
  });

  it("covers the remaining entities", () => {
    expect(buildUnitImpact({ meters: 1, tenants: 1 })).toEqual([
      { label: "Meters unassigned", count: 1, severity: "unassign" },
      { label: "Tenants unassigned from this unit", count: 1, severity: "unassign" },
    ]);
    expect(buildLeaseImpact({ signatures: 2 })).toEqual([
      { label: "Signatures deleted", count: 2, severity: "delete" },
    ]);
    expect(buildMeterImpact({ tenantsUnassigned: 1, payments: 3, tokens: 2 })).toEqual([
      { label: "Tenants unassigned from this meter", count: 1, severity: "unassign" },
      { label: "Payments unlinked (kept for records)", count: 3, severity: "unassign" },
      { label: "Token purchases unlinked (kept for records)", count: 2, severity: "unassign" },
    ]);
    expect(buildPayoutImpact({ linkedPayments: 4 })).toEqual([
      { label: "Payment links removed (payments themselves kept)", count: 4, severity: "unassign" },
    ]);
    expect(buildStaffImpact({ skills: 3, appointments: 2 })).toEqual([
      { label: "Skills removed", count: 3, severity: "delete" },
      { label: "Appointments unassigned", count: 2, severity: "unassign" },
    ]);
  });
});
