/**
 * Cross-cutting report aggregates for the admin Reports hub.
 * Composes payments, payouts, meters, tenants, landlords, buildings (mock/demo).
 */

import { getBuildings } from "@/lib/buildings-data";
import { getLandlordRows } from "@/lib/landlords-data";
import { getMeterRows, type MeterRow } from "@/lib/meters-data";
import {
  buildInitialDashboardPayments,
  categoryLabel,
  type DashboardPayment,
  type PaymentCategory,
} from "@/lib/payments-data";
import { buildPayoutLedger, PLATFORM_FEE_RATE, type PayoutLedgerRow } from "@/lib/payouts-data";
import { MOCK_TENANTS, type PaymentRow, type TenantStatus } from "@/lib/tenants-data";
import { sourceLabel, type TokenPurchaseRow, type TokenPurchaseSource } from "@/lib/tokens-data";

export type RevenueByCategory = { category: PaymentCategory; label: string; amountKes: number; fill: string };

export type RevenueByMethod = { method: PaymentRow["method"]; label: string; amountKes: number };

export type TenantLeaderRow = {
  tenantId: string;
  tenantName: string;
  amountKes: number;
  sharePct: number;
};

export type RevenueReport = {
  completedVolumeKes: number;
  completedCount: number;
  byCategory: RevenueByCategory[];
  byMethod: RevenueByMethod[];
  topTenants: TenantLeaderRow[];
};

export type PayoutReport = {
  totalGrossKes: number;
  totalFeeKes: number;
  totalNetKes: number;
  completedNetKes: number;
  pendingNetKes: number;
  countByStatus: { completed: number; pending: number; failed: number };
  netByRail: { rail: "m_pesa_b2b" | "bank_transfer"; netKes: number; label: string }[];
  recent: PayoutLedgerRow[];
};

export type MeterFleetReport = {
  total: number;
  online: number;
  intermittent: number;
  offline: number;
  statusActive: number;
  statusInactive: number;
  statusMaintenance: number;
  statusFault: number;
  needsAttention: number;
};

export type PortfolioReport = {
  tenantCount: number;
  tenantByStatus: Record<TenantStatus, number>;
  landlordCount: number;
  landlordActive: number;
  buildingCount: number;
  totalUnitsApprox: number;
};

export type TokenPurchaseReport = {
  count: number;
  volumeKes: number;
  bySource: { source: TokenPurchaseSource; label: string; count: number; volumeKes: number }[];
};

export function aggregateTokenPurchases(rows: TokenPurchaseRow[]): TokenPurchaseReport {
  const volumeKes = rows.reduce((s, r) => s + r.amountKes, 0);
  const sources: TokenPurchaseSource[] = ["app", "m_pesa", "manual"];
  const bySource = sources.map((source) => {
    const sub = rows.filter((r) => r.source === source);
    return {
      source,
      label: sourceLabel(source),
      count: sub.length,
      volumeKes: sub.reduce((s, r) => s + r.amountKes, 0),
    };
  });
  return { count: rows.length, volumeKes, bySource };
}

export type OverviewMetrics = {
  completedCollectionKes: number;
  pendingPaymentCount: number;
  netPayoutsCompletedKes: number;
  pendingPayoutKes: number;
  meterOnlinePct: number;
  tokensPurchasedCount: number;
  /** From base token ledger only; browser manual rows optional in UI. */
  tokenVolumeKes: number;
};

const CAT_COLOR: Record<PaymentCategory, string> = {
  rent: "#7c3aed",
  tokens: "#059669",
  service: "#d97706",
};

/** Aggregate completed payments into revenue breakdown (admin or landlord-scoped rows). */
export function buildRevenueReportFromPayments(allPayments: DashboardPayment[]): RevenueReport {
  const payments = allPayments.filter((p) => p.status === "completed");
  const completedVolumeKes = payments.reduce((s, p) => s + p.amountKes, 0);

  const catMap = new Map<PaymentCategory, number>();
  for (const p of payments) {
    catMap.set(p.category, (catMap.get(p.category) ?? 0) + p.amountKes);
  }
  const categories: PaymentCategory[] = ["rent", "tokens", "service"];
  const byCategory: RevenueByCategory[] = categories.map((category) => ({
    category,
    label: categoryLabel(category),
    amountKes: catMap.get(category) ?? 0,
    fill: CAT_COLOR[category],
  }));

  const methods: PaymentRow["method"][] = ["M-Pesa", "STS credit", "Bank", "Cash"];
  const byMethod: RevenueByMethod[] = methods
    .map((method) => ({
      method,
      label: method,
      amountKes: payments.filter((p) => p.method === method).reduce((s, p) => s + p.amountKes, 0),
    }))
    .filter((m) => m.amountKes > 0);

  const tenantMap = new Map<string, { tenantName: string; amountKes: number }>();
  for (const p of payments) {
    const cur = tenantMap.get(p.tenantId) ?? { tenantName: p.tenantName, amountKes: 0 };
    cur.amountKes += p.amountKes;
    tenantMap.set(p.tenantId, cur);
  }
  const sorted = Array.from(tenantMap.entries())
    .map(([tenantId, v]) => ({ tenantId, tenantName: v.tenantName, amountKes: v.amountKes }))
    .sort((a, b) => b.amountKes - a.amountKes)
    .slice(0, 10);
  const topTotal = sorted.reduce((s, t) => s + t.amountKes, 0) || 1;
  const topTenants: TenantLeaderRow[] = sorted.map((t) => ({
    ...t,
    sharePct: Math.round((t.amountKes / topTotal) * 1000) / 10,
  }));

  return {
    completedVolumeKes: completedVolumeKes,
    completedCount: payments.length,
    byCategory,
    byMethod,
    topTenants,
  };
}

export function getRevenueReport(): RevenueReport {
  return buildRevenueReportFromPayments(buildInitialDashboardPayments());
}

export function buildPayoutReportFromRows(rows: PayoutLedgerRow[]): PayoutReport {
  const totalGrossKes = rows.reduce((s, r) => s + r.grossKes, 0);
  const totalFeeKes = rows.reduce((s, r) => s + r.platformFeeKes, 0);
  const totalNetKes = rows.reduce((s, r) => s + r.netPayoutKes, 0);
  const completedNetKes = rows.filter((r) => r.status === "completed").reduce((s, r) => s + r.netPayoutKes, 0);
  const pendingNetKes = rows.filter((r) => r.status === "pending").reduce((s, r) => s + r.netPayoutKes, 0);
  const countByStatus = {
    completed: rows.filter((r) => r.status === "completed").length,
    pending: rows.filter((r) => r.status === "pending").length,
    failed: rows.filter((r) => r.status === "failed").length,
  };
  const mpesa = rows.filter((r) => r.rail === "m_pesa_b2b").reduce((s, r) => s + r.netPayoutKes, 0);
  const bank = rows.filter((r) => r.rail === "bank_transfer").reduce((s, r) => s + r.netPayoutKes, 0);
  const netByRail = [
    { rail: "m_pesa_b2b" as const, netKes: mpesa, label: "M-Pesa B2B" },
    { rail: "bank_transfer" as const, netKes: bank, label: "Bank" },
  ];
  const recent = [...rows].sort((a, b) => b.scheduledAtIso.localeCompare(a.scheduledAtIso)).slice(0, 8);

  return {
    totalGrossKes,
    totalFeeKes,
    totalNetKes,
    completedNetKes,
    pendingNetKes,
    countByStatus,
    netByRail,
    recent,
  };
}

export function getPayoutReport(): PayoutReport {
  return buildPayoutReportFromRows(buildPayoutLedger());
}

export function aggregateMeterFleetFromRows(meters: MeterRow[]): MeterFleetReport {
  const total = meters.length;
  let online = 0;
  let intermittent = 0;
  let offline = 0;
  let statusActive = 0;
  let statusInactive = 0;
  let statusMaintenance = 0;
  let statusFault = 0;
  let needsAttention = 0;
  for (const m of meters) {
    if (m.connectivity === "online") online++;
    else if (m.connectivity === "intermittent") intermittent++;
    else offline++;
    if (m.status === "active") statusActive++;
    else if (m.status === "inactive") statusInactive++;
    else if (m.status === "maintenance") statusMaintenance++;
    else if (m.status === "fault") statusFault++;
    if (
      m.status === "fault" ||
      m.status === "maintenance" ||
      m.connectivity === "offline" ||
      m.openAlerts > 0
    ) {
      needsAttention++;
    }
  }
  return {
    total,
    online,
    intermittent,
    offline,
    statusActive,
    statusInactive,
    statusMaintenance,
    statusFault,
    needsAttention,
  };
}

export function getMeterFleetReport(): MeterFleetReport {
  return aggregateMeterFleetFromRows(getMeterRows());
}

export function getPortfolioReport(): PortfolioReport {
  const tenants = MOCK_TENANTS;
  const tenantByStatus = {
    active: 0,
    low_credit: 0,
    inactive: 0,
    overdue: 0,
  } as Record<TenantStatus, number>;
  for (const t of tenants) {
    tenantByStatus[t.status]++;
  }
  const landlords = getLandlordRows();
  return {
    tenantCount: tenants.length,
    tenantByStatus,
    landlordCount: landlords.length,
    landlordActive: landlords.filter((l) => l.status === "active").length,
    buildingCount: getBuildings().length,
    totalUnitsApprox: tenants.length,
  };
}

/** Overview KPIs; pass merged token ledger from client (includes localStorage manual rows when in browser). */
export function getOverviewMetrics(tokenVolumeKesFromLedger: number, tokenCount: number): OverviewMetrics {
  const payments = buildInitialDashboardPayments();
  const completed = payments.filter((p) => p.status === "completed");
  const completedCollectionKes = completed.reduce((s, p) => s + p.amountKes, 0);
  const pendingPaymentCount = payments.filter((p) => p.status === "pending").length;

  const payoutRows = buildPayoutLedger();
  const netPayoutsCompletedKes = payoutRows
    .filter((r) => r.status === "completed")
    .reduce((s, r) => s + r.netPayoutKes, 0);
  const pendingPayoutKes = payoutRows.filter((r) => r.status === "pending").reduce((s, r) => s + r.netPayoutKes, 0);

  const fleet = getMeterFleetReport();
  const meterOnlinePct = fleet.total === 0 ? 0 : Math.round((fleet.online / fleet.total) * 1000) / 10;

  return {
    completedCollectionKes,
    pendingPaymentCount,
    netPayoutsCompletedKes,
    pendingPayoutKes,
    meterOnlinePct,
    tokensPurchasedCount: tokenCount,
    tokenVolumeKes: tokenVolumeKesFromLedger,
  };
}

export { PLATFORM_FEE_RATE };
