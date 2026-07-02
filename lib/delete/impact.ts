import type { ImpactItem } from "@/lib/delete/types";

/** Keep only lines that describe a real consequence. */
function compact(items: ImpactItem[]): ImpactItem[] {
  return items.filter((it) => it.count > 0);
}

export function buildBuildingImpact(counts: {
  units: number;
  meters: number;
  tenants: number;
}): ImpactItem[] {
  return compact([
    { label: "Houses/units deleted", count: counts.units, severity: "delete" },
    { label: "Meters unassigned", count: counts.meters, severity: "unassign" },
    { label: "Tenants unassigned from this building", count: counts.tenants, severity: "unassign" },
  ]);
}

export function buildUnitImpact(counts: { meters: number; tenants: number }): ImpactItem[] {
  return compact([
    { label: "Meters unassigned", count: counts.meters, severity: "unassign" },
    { label: "Tenants unassigned from this unit", count: counts.tenants, severity: "unassign" },
  ]);
}

export function buildTenantImpact(counts: {
  unitFreed: number;
  authUser: number;
  leases: number;
  payments: number;
  tokens: number;
}): ImpactItem[] {
  return compact([
    { label: "Unit freed (marked vacant)", count: counts.unitFreed, severity: "unassign" },
    { label: "Login account removed", count: counts.authUser, severity: "delete" },
    { label: "Leases deleted", count: counts.leases, severity: "delete" },
    { label: "Payments unlinked (kept for records)", count: counts.payments, severity: "unassign" },
    { label: "Token purchases unlinked (kept for records)", count: counts.tokens, severity: "unassign" },
  ]);
}

export function buildLeaseImpact(counts: { signatures: number }): ImpactItem[] {
  return compact([
    { label: "Signatures deleted", count: counts.signatures, severity: "delete" },
  ]);
}

export function buildMeterImpact(counts: {
  tenantsUnassigned: number;
  payments: number;
  tokens: number;
}): ImpactItem[] {
  return compact([
    { label: "Tenants unassigned from this meter", count: counts.tenantsUnassigned, severity: "unassign" },
    { label: "Payments unlinked (kept for records)", count: counts.payments, severity: "unassign" },
    { label: "Token purchases unlinked (kept for records)", count: counts.tokens, severity: "unassign" },
  ]);
}

export function buildPayoutImpact(counts: { linkedPayments: number }): ImpactItem[] {
  return compact([
    {
      label: "Payment links removed (payments themselves kept)",
      count: counts.linkedPayments,
      severity: "unassign",
    },
  ]);
}

export function buildLandlordImpact(counts: {
  buildings: number;
  units: number;
  tenants: number;
  meters: number;
  payouts: number;
}): ImpactItem[] {
  return compact([
    { label: "Tenants deleted (incl. their logins)", count: counts.tenants, severity: "delete" },
    { label: "Buildings deleted", count: counts.buildings, severity: "delete" },
    { label: "Houses/units deleted", count: counts.units, severity: "delete" },
    { label: "Payouts deleted", count: counts.payouts, severity: "delete" },
    { label: "Meters unassigned", count: counts.meters, severity: "unassign" },
  ]);
}

export function buildStaffImpact(counts: { skills: number; appointments: number }): ImpactItem[] {
  return compact([
    { label: "Skills removed", count: counts.skills, severity: "delete" },
    { label: "Appointments unassigned", count: counts.appointments, severity: "unassign" },
  ]);
}
