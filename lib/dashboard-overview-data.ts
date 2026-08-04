/**
 * Pure aggregation helpers for the admin /dashboard overview. No Supabase
 * import — callers (Server Components) fetch rows via
 * lib/supabase/queries.ts and pass them in here.
 */

import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import type {
  MeterRow,
  PaymentRow,
  TenantRow,
  TokenPurchaseRow,
} from "@/lib/supabase/types";

function kes(amount: number | string | null): number {
  return Number(amount) || 0;
}

function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

// ---------- Dashboard summary (summary cards) -------------------------------

export type DashboardSummary = {
  meters: { total: number; online: number; offline: number; intermittent: number; unknown: number };
  tenants: { total: number; active: number; overdue: number; lowCredit: number; inactive: number };
  revenue: {
    allTimeCompletedKes: number;
    thisMonthCompletedKes: number;
    lastMonthCompletedKes: number;
    /**
     * Rounded to the nearest whole percent. null when
     * lastMonthCompletedKes is 0 (no baseline to compare against).
     */
    momChangePct: number | null;
  };
  alerts: { openAlertsTotal: number; metersWithAlerts: number };
};

export function summarizeDashboard(
  payments: PaymentRow[],
  tenants: TenantRow[],
  meters: MeterRow[],
  now: Date
): DashboardSummary {
  const meterSummary = { total: meters.length, online: 0, offline: 0, intermittent: 0, unknown: 0 };
  for (const m of meters) {
    if (m.connectivity_status === "online") meterSummary.online += 1;
    else if (m.connectivity_status === "offline") meterSummary.offline += 1;
    else if (m.connectivity_status === "intermittent") meterSummary.intermittent += 1;
    else meterSummary.unknown += 1;
  }

  const tenantSummary = { total: tenants.length, active: 0, overdue: 0, lowCredit: 0, inactive: 0 };
  for (const t of tenants) {
    if (t.status === "active") tenantSummary.active += 1;
    else if (t.status === "overdue") tenantSummary.overdue += 1;
    else if (t.status === "low_credit") tenantSummary.lowCredit += 1;
    else if (t.status === "inactive") tenantSummary.inactive += 1;
  }

  const thisMonthStart = startOfMonth(now.getFullYear(), now.getMonth());
  const nextMonthStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);
  const lastMonthStart = startOfMonth(now.getFullYear(), now.getMonth() - 1);

  let allTimeCompletedKes = 0;
  let thisMonthCompletedKes = 0;
  let lastMonthCompletedKes = 0;
  for (const p of payments) {
    if (p.status !== "completed") continue;
    const amount = kes(p.amount_kes);
    allTimeCompletedKes += amount;
    const createdAt = new Date(p.created_at);
    if (createdAt >= thisMonthStart && createdAt < nextMonthStart) {
      thisMonthCompletedKes += amount;
    } else if (createdAt >= lastMonthStart && createdAt < thisMonthStart) {
      lastMonthCompletedKes += amount;
    }
  }
  const momChangePct =
    lastMonthCompletedKes === 0
      ? null
      : Math.round(((thisMonthCompletedKes - lastMonthCompletedKes) / lastMonthCompletedKes) * 100);

  let openAlertsTotal = 0;
  let metersWithAlerts = 0;
  for (const m of meters) {
    openAlertsTotal += m.open_alerts;
    if (m.open_alerts > 0) metersWithAlerts += 1;
  }

  return {
    meters: meterSummary,
    tenants: tenantSummary,
    revenue: { allTimeCompletedKes, thisMonthCompletedKes, lastMonthCompletedKes, momChangePct },
    alerts: { openAlertsTotal, metersWithAlerts },
  };
}

/**
 * Single source of the "+X% from last month" / "No prior-month data"
 * string — every caller that displays a month-over-month change (the
 * Total Revenue summary card and the Total Earnings metric-card panel)
 * uses this instead of formatting momChangePct inline.
 */
export function formatMomChangeLabel(momChangePct: number | null): string {
  if (momChangePct === null) return "No prior-month data";
  return `${momChangePct >= 0 ? "+" : ""}${momChangePct}% from last month`;
}

// ---------- Token sales (this month) -----------------------------------------

export type TokenSalesSummary = {
  /** All utilities, this calendar month. */
  thisMonthKes: number;
  /** Electricity-utility purchases only, this month — see Global Constraints. */
  deliveredCount: number;
  pendingCount: number;
  totalCount: number;
};

function isElectricityPurchase(
  purchase: TokenPurchaseRow,
  meterModelTypeById: Map<string, MeterModelType>
): boolean {
  if (!purchase.meter_id) return false;
  const modelType = meterModelTypeById.get(purchase.meter_id);
  return modelType !== undefined && utilityOfModelType(modelType) === "electricity";
}

export function summarizeTokenSales(
  tokenPurchases: TokenPurchaseRow[],
  meterModelTypeById: Map<string, MeterModelType>,
  now: Date
): TokenSalesSummary {
  const monthStart = startOfMonth(now.getFullYear(), now.getMonth());
  const nextMonthStart = startOfMonth(now.getFullYear(), now.getMonth() + 1);

  let thisMonthKes = 0;
  let deliveredCount = 0;
  let pendingCount = 0;
  for (const t of tokenPurchases) {
    const createdAt = new Date(t.created_at);
    if (createdAt < monthStart || createdAt >= nextMonthStart) continue;
    thisMonthKes += kes(t.amount_kes);
    if (!isElectricityPurchase(t, meterModelTypeById)) continue;
    if (t.delivery_status === "uploaded") deliveredCount += 1;
    else if (t.delivery_status === "pending") pendingCount += 1;
  }

  return { thisMonthKes, deliveredCount, pendingCount, totalCount: deliveredCount + pendingCount };
}

/** All-time count — an operational queue, not scoped to "this month". */
export function countPendingElectricityDeliveries(
  tokenPurchases: TokenPurchaseRow[],
  meterModelTypeById: Map<string, MeterModelType>
): number {
  return tokenPurchases.filter(
    (t) => t.delivery_status === "pending" && isElectricityPurchase(t, meterModelTypeById)
  ).length;
}
