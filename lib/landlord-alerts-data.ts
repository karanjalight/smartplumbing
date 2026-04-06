/**
 * Landlord portal alerts — derived from merged meters, tenants, and finance data (demo).
 */

import { mergeDashboardPaymentsForLandlord, type LandlordFinanceStore } from "@/lib/landlord-finance-storage";
import { getLandlordMeterRowsMerged } from "@/lib/landlord-meters-data";
import { getLandlordTenantsMerged, type PortfolioStore } from "@/lib/landlord-portfolio-storage";
import type { MeterRow } from "@/lib/meters-data";
import type { TenantRow } from "@/lib/tenants-data";

export type LandlordAlertSeverity = "critical" | "warning" | "info";

export type LandlordAlertCategory = "meter" | "tenant" | "payment" | "system";

export type LandlordAlert = {
  id: string;
  severity: LandlordAlertSeverity;
  category: LandlordAlertCategory;
  title: string;
  description: string;
  createdAtIso: string;
  href?: string;
};

const MAX_ALERTS = 80;

function pushUnique(out: LandlordAlert[], a: LandlordAlert) {
  if (out.length >= MAX_ALERTS) return;
  out.push(a);
}

function meterAlerts(m: MeterRow, out: LandlordAlert[]) {
  const base = `/landlords/dashboard/meters`;
  const t = new Date(m.lastSyncAt).toISOString();

  if (m.status === "fault") {
    pushUnique(out, {
      id: `meter-${m.meterId}-fault`,
      severity: "critical",
      category: "meter",
      title: `Meter fault: ${m.meterId}`,
      description: `${m.buildingName ?? "Property"} · ${m.unitLabel ?? "Unit"} — device reports a fault. Check valve and STS credit.`,
      createdAtIso: t,
      href: base,
    });
  } else if (m.status === "maintenance") {
    pushUnique(out, {
      id: `meter-${m.meterId}-maintenance`,
      severity: "warning",
      category: "meter",
      title: `Maintenance scheduled: ${m.meterId}`,
      description: `${m.buildingName ?? "—"} — meter marked for maintenance.`,
      createdAtIso: t,
      href: base,
    });
  }

  if (m.connectivity === "offline") {
    pushUnique(out, {
      id: `meter-${m.meterId}-offline`,
      severity: "warning",
      category: "meter",
      title: `Meter offline: ${m.meterId}`,
      description: `Last sync ${m.lastSyncAt}. ${m.tenantName ? `Tenant: ${m.tenantName}.` : ""} Verify power and network.`,
      createdAtIso: t,
      href: base,
    });
  } else if (m.connectivity === "intermittent") {
    pushUnique(out, {
      id: `meter-${m.meterId}-intermittent`,
      severity: "warning",
      category: "meter",
      title: `Intermittent connectivity: ${m.meterId}`,
      description: `Signal unstable at ${m.buildingName ?? "property"}. May affect remote valve or readings.`,
      createdAtIso: t,
      href: base,
    });
  }

  if (m.openAlerts > 0) {
    pushUnique(out, {
      id: `meter-${m.meterId}-open-${m.openAlerts}`,
      severity: "warning",
      category: "meter",
      title: `${m.openAlerts} open alert(s): ${m.meterId}`,
      description: `Review abnormal usage or billing flags for this unit.`,
      createdAtIso: t,
      href: base,
    });
  }
}

function tenantAlerts(t: TenantRow, out: LandlordAlert[]) {
  const href = `/landlords/dashboard/tenants?highlight=${encodeURIComponent(t.id)}`;
  const created = "2026-04-04T10:00:00.000Z";

  if (t.status === "overdue") {
    pushUnique(out, {
      id: `tenant-${t.id}-overdue`,
      severity: "critical",
      category: "tenant",
      title: `Rent overdue: ${t.name}`,
      description: `${t.property} · ${t.unit} — follow up on lease or water balance.`,
      createdAtIso: created,
      href,
    });
  } else if (t.status === "low_credit") {
    pushUnique(out, {
      id: `tenant-${t.id}-low-credit`,
      severity: "warning",
      category: "tenant",
      title: `Low STS credit: ${t.name}`,
      description: `${t.property} — prepaid balance may run out soon. Last token ${t.lastTokenPreview}.`,
      createdAtIso: created,
      href,
    });
  } else if (t.status === "inactive") {
    pushUnique(out, {
      id: `tenant-${t.id}-inactive`,
      severity: "warning",
      category: "tenant",
      title: `Inactive account: ${t.name}`,
      description: `${t.property} — unit may be vacant or account suspended.`,
      createdAtIso: created,
      href,
    });
  }
}

function paymentAlerts(
  landlordId: string,
  portfolio: PortfolioStore,
  finance: LandlordFinanceStore,
  out: LandlordAlert[]
) {
  const payments = mergeDashboardPaymentsForLandlord(landlordId, portfolio, finance);
  const recent = [...payments].sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
  let pendingN = 0;
  let failedN = 0;

  for (const p of recent) {
    if (out.length >= MAX_ALERTS) return;
    if (p.status === "failed" && failedN < 12) {
      failedN++;
      pushUnique(out, {
        id: `payment-${p.id}-failed`,
        severity: "critical",
        category: "payment",
        title: `Payment failed: ${p.tenantName}`,
        description: `${p.reference} · ${p.amountKes.toLocaleString("en-KE")} KES (${p.category}) — reconcile with M-Pesa or bank.`,
        createdAtIso: p.createdAtIso,
        href: `/landlords/dashboard/finance/payments`,
      });
    } else if (p.status === "pending" && pendingN < 8) {
      pendingN++;
      pushUnique(out, {
        id: `payment-${p.id}-pending`,
        severity: "info",
        category: "payment",
        title: `Payment pending: ${p.tenantName}`,
        description: `${p.reference} · ${p.amountKes.toLocaleString("en-KE")} KES via ${p.method}.`,
        createdAtIso: p.createdAtIso,
        href: `/landlords/dashboard/finance/payments`,
      });
    }
  }
}

function systemAlerts(landlordId: string, out: LandlordAlert[]) {
  pushUnique(out, {
    id: `system-${landlordId}-digest`,
    severity: "info",
    category: "system",
    title: "Weekly summary available",
    description: "Collections and meter health for your portfolio were summarized. Open Reports for CSV / JSON exports.",
    createdAtIso: "2026-04-05T08:00:00.000Z",
    href: "/landlords/dashboard/reports",
  });
  pushUnique(out, {
    id: `system-${landlordId}-payout`,
    severity: "info",
    category: "system",
    title: "Next payout window",
    description: "Platform settlements typically batch after month-end. Confirm payout rail under Finance → Payouts.",
    createdAtIso: "2026-04-03T14:30:00.000Z",
    href: "/landlords/dashboard/finance/payouts",
  });
}

function severityOrder(s: LandlordAlertSeverity): number {
  if (s === "critical") return 0;
  if (s === "warning") return 1;
  return 2;
}

/**
 * Build actionable alerts for the landlord (deterministic from current merged data).
 */
export function buildLandlordAlerts(
  landlordId: string,
  portfolio: PortfolioStore,
  finance: LandlordFinanceStore
): LandlordAlert[] {
  const out: LandlordAlert[] = [];

  const meters = getLandlordMeterRowsMerged(landlordId, portfolio);
  for (const m of meters) {
    meterAlerts(m, out);
    if (out.length >= MAX_ALERTS) break;
  }

  const tenants = getLandlordTenantsMerged(landlordId, portfolio);
  for (const t of tenants) {
    tenantAlerts(t, out);
    if (out.length >= MAX_ALERTS) break;
  }

  paymentAlerts(landlordId, portfolio, finance, out);
  systemAlerts(landlordId, out);

  const seen = new Set<string>();
  const deduped: LandlordAlert[] = [];
  for (const a of out) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    deduped.push(a);
  }

  deduped.sort((a, b) => {
    const s = severityOrder(a.severity) - severityOrder(b.severity);
    if (s !== 0) return s;
    return b.createdAtIso.localeCompare(a.createdAtIso);
  });

  return deduped;
}
