/**
 * Landlord portal reports — scoped to one landlord using merged portfolio + finance stores.
 */

import { getLandlordBuildingsMerged, getLandlordTenantsMerged, type PortfolioStore } from "@/lib/landlord-portfolio-storage";
import {
  mergeDashboardPaymentsForLandlord,
  mergePayoutLedgerForLandlord,
  type LandlordFinanceStore,
} from "@/lib/landlord-finance-storage";
import { getLandlordMeterRowsMerged } from "@/lib/landlord-meters-data";
import type { DashboardPayment } from "@/lib/payments-data";
import type { PayoutLedgerRow } from "@/lib/payouts-data";
import {
  aggregateMeterFleetFromRows,
  aggregateTokenPurchases,
  buildPayoutReportFromRows,
  buildRevenueReportFromPayments,
  type MeterFleetReport,
  type OverviewMetrics,
  type PayoutReport,
  type RevenueReport,
  type TokenPurchaseReport,
} from "@/lib/reports-data";
import { getBasePurchasedTokenRows, readStoredManualPurchases, type TokenPurchaseRow } from "@/lib/tokens-data";
import type { TenantStatus } from "@/lib/tenants-data";

/** Aligns with dashboard payments demo anchor for period filters. */
const DEMO_ANCHOR = new Date("2026-04-05T23:59:59.000Z");

export type LandlordReportPeriod = "all" | "7d" | "30d" | "90d";

export const LANDLORD_REPORT_PERIOD_OPTIONS: { key: LandlordReportPeriod; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
];

export function reportPeriodCutoff(period: LandlordReportPeriod): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const d = new Date(DEMO_ANCHOR);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export function filterPaymentsByPeriod(
  payments: DashboardPayment[],
  period: LandlordReportPeriod
): DashboardPayment[] {
  const cutoff = reportPeriodCutoff(period);
  if (!cutoff) return payments;
  return payments.filter((p) => new Date(p.createdAtIso) >= cutoff);
}

export function filterPayoutsByPeriod(
  rows: PayoutLedgerRow[],
  period: LandlordReportPeriod
): PayoutLedgerRow[] {
  const cutoff = reportPeriodCutoff(period);
  if (!cutoff) return rows;
  return rows.filter((r) => new Date(r.scheduledAtIso) >= cutoff);
}

function tokenRowTimeMs(r: TokenPurchaseRow): number {
  const s = r.createdAt.includes("T") ? r.createdAt : r.createdAt.replace(" ", "T");
  const t = Date.parse(s);
  return Number.isNaN(t) ? 0 : t;
}

export function filterTokenRowsByPeriod(
  rows: TokenPurchaseRow[],
  period: LandlordReportPeriod
): TokenPurchaseRow[] {
  const cutoff = reportPeriodCutoff(period);
  if (!cutoff) return rows;
  const t0 = cutoff.getTime();
  return rows.filter((r) => tokenRowTimeMs(r) >= t0);
}

/**
 * Token ledger rows for meters assigned to this landlord's merged tenant list (demo + portfolio).
 */
export function mergeLandlordTokenLedger(landlordId: string, portfolio: PortfolioStore): TokenPurchaseRow[] {
  const tenants = getLandlordTenantsMerged(landlordId, portfolio);
  const meterSet = new Set(tenants.map((t) => t.meterId).filter(Boolean));
  const base = getBasePurchasedTokenRows();
  const stored = readStoredManualPurchases();
  const merged = [...stored, ...base];
  const seen = new Set<string>();
  const out: TokenPurchaseRow[] = [];
  for (const r of merged) {
    if (seen.has(r.id)) continue;
    if (meterSet.has(r.meterNo)) {
      seen.add(r.id);
      out.push(r);
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type LandlordPropertiesReport = {
  buildingCount: number;
  tenantCount: number;
  tenantByStatus: Record<TenantStatus, number>;
  /** Sum of houseCount across buildings (capacity, not occupied). */
  unitCapacityApprox: number;
  /** Buildings with at least one saved water pricing override field. */
  waterPricingCustomizedCount: number;
};

export function getLandlordPropertiesReport(
  landlordId: string,
  portfolio: PortfolioStore
): LandlordPropertiesReport {
  const tenants = getLandlordTenantsMerged(landlordId, portfolio);
  const buildings = getLandlordBuildingsMerged(landlordId, portfolio);
  const tenantByStatus: Record<TenantStatus, number> = {
    active: 0,
    low_credit: 0,
    inactive: 0,
    overdue: 0,
  };
  for (const t of tenants) {
    tenantByStatus[t.status]++;
  }
  const buildingIds = new Set(buildings.map((b) => b.id));
  let waterPricingCustomizedCount = 0;
  for (const id of buildingIds) {
    const o = portfolio.waterPricingOverrides[id];
    if (o && Object.keys(o).length > 0) waterPricingCustomizedCount++;
  }
  return {
    buildingCount: buildings.length,
    tenantCount: tenants.length,
    tenantByStatus,
    unitCapacityApprox: buildings.reduce((s, b) => s + b.houseCount, 0),
    waterPricingCustomizedCount,
  };
}

export function getLandlordOverviewMetrics(
  payments: DashboardPayment[],
  payoutRows: PayoutLedgerRow[],
  fleet: MeterFleetReport,
  tokenVolumeKes: number,
  tokenCount: number
): OverviewMetrics {
  const completed = payments.filter((p) => p.status === "completed");
  const completedCollectionKes = completed.reduce((s, p) => s + p.amountKes, 0);
  const pendingPaymentCount = payments.filter((p) => p.status === "pending").length;
  const netPayoutsCompletedKes = payoutRows
    .filter((r) => r.status === "completed")
    .reduce((s, r) => s + r.netPayoutKes, 0);
  const pendingPayoutKes = payoutRows.filter((r) => r.status === "pending").reduce((s, r) => s + r.netPayoutKes, 0);
  const meterOnlinePct =
    fleet.total === 0 ? 0 : Math.round((fleet.online / fleet.total) * 1000) / 10;

  return {
    completedCollectionKes,
    pendingPaymentCount,
    netPayoutsCompletedKes,
    pendingPayoutKes,
    meterOnlinePct,
    tokensPurchasedCount: tokenCount,
    tokenVolumeKes,
  };
}

export type LandlordReportsBundle = {
  revenue: RevenueReport;
  payout: PayoutReport;
  tokenReport: TokenPurchaseReport;
  fleet: MeterFleetReport;
  properties: LandlordPropertiesReport;
  overview: OverviewMetrics;
};

/** Build all aggregates for the landlord portal (call from client when stores are loaded). */
export function buildLandlordReportsBundle(
  landlordId: string,
  portfolio: PortfolioStore,
  finance: LandlordFinanceStore,
  period: LandlordReportPeriod
): LandlordReportsBundle {
  const allPayments = mergeDashboardPaymentsForLandlord(landlordId, portfolio, finance);
  const payments = filterPaymentsByPeriod(allPayments, period);

  const allPayouts = mergePayoutLedgerForLandlord(landlordId, finance);
  const payoutRows = filterPayoutsByPeriod(allPayouts, period);

  const allTokens = mergeLandlordTokenLedger(landlordId, portfolio);
  const tokenRows = filterTokenRowsByPeriod(allTokens, period);
  const tokenReport = aggregateTokenPurchases(tokenRows);

  const meters = getLandlordMeterRowsMerged(landlordId, portfolio);
  const fleet = aggregateMeterFleetFromRows(meters);

  const properties = getLandlordPropertiesReport(landlordId, portfolio);

  const revenue = buildRevenueReportFromPayments(payments);
  const payout = buildPayoutReportFromRows(payoutRows);

  const overview = getLandlordOverviewMetrics(
    payments,
    payoutRows,
    fleet,
    tokenReport.volumeKes,
    tokenReport.count
  );

  return {
    revenue,
    payout,
    tokenReport,
    fleet,
    properties,
    overview,
  };
}
