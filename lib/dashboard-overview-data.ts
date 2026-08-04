/**
 * Pure aggregation helpers for the admin /dashboard overview. No Supabase
 * import — callers (Server Components) fetch rows via
 * lib/supabase/queries.ts and pass them in here.
 */

import { utilityOfModelType, type MeterModelType } from "@/lib/meters-data";
import type {
  MeterRow,
  PaymentCategory,
  PaymentMethod,
  PaymentRow,
  PaymentStatus,
  TenantRow,
  TokenDeliveryStatus,
  TokenPurchaseRow,
  TokenSource,
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

// ---------- Payment method mix -----------------------------------------------

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type PaymentMethodSlice = { name: PaymentMethod; kes: number; pct: number };

/**
 * Completed payments only, in [fromIso, toIso). Methods with 0 KES are
 * omitted. `pct` is rounded independently per slice, so the set may not sum
 * to exactly 100 (fine for display — recharts renders proportionally).
 */
export function summarizePaymentMethodMix(
  payments: PaymentRow[],
  fromIso: string,
  toIso: string
): PaymentMethodSlice[] {
  const totals = new Map<PaymentMethod, number>();
  for (const p of payments) {
    if (p.status !== "completed") continue;
    if (p.created_at < fromIso || p.created_at >= toIso) continue;
    totals.set(p.method, (totals.get(p.method) ?? 0) + kes(p.amount_kes));
  }
  const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0);
  if (grandTotal === 0) return [];
  return [...totals.entries()]
    .map(([name, amount]) => ({ name, kes: amount, pct: Math.round((amount / grandTotal) * 100) }))
    .sort((a, b) => b.kes - a.kes);
}

// ---------- Monthly revenue ---------------------------------------------------

export type MonthlyRevenuePoint = { month: string; kes: number };

/** Completed payments only, January through the current month of `year`. */
export function summarizeMonthlyRevenue(
  payments: PaymentRow[],
  year: number,
  now: Date
): MonthlyRevenuePoint[] {
  const monthCount =
    year === now.getFullYear() ? now.getMonth() + 1 : year < now.getFullYear() ? 12 : 0;

  const totals = new Array(monthCount).fill(0);
  for (const p of payments) {
    if (p.status !== "completed") continue;
    const createdAt = new Date(p.created_at);
    if (createdAt.getFullYear() !== year) continue;
    const monthIndex = createdAt.getMonth();
    if (monthIndex < monthCount) totals[monthIndex] += kes(p.amount_kes);
  }

  return totals.map((total, index) => ({ month: MONTH_LABELS[index], kes: total }));
}

// ---------- Category distribution ---------------------------------------------

export type CategorySlice = { category: PaymentCategory; kes: number; pct: number };

/**
 * Completed payments only, in [fromIso, toIso). Sorted desc by kes. Zero
 * categories omitted. Same rounding-tolerance note as PaymentMethodSlice.
 */
export function summarizeCategoryDistribution(
  payments: PaymentRow[],
  fromIso: string,
  toIso: string
): CategorySlice[] {
  const totals = new Map<PaymentCategory, number>();
  for (const p of payments) {
    if (p.status !== "completed") continue;
    if (p.created_at < fromIso || p.created_at >= toIso) continue;
    totals.set(p.category, (totals.get(p.category) ?? 0) + kes(p.amount_kes));
  }
  const grandTotal = [...totals.values()].reduce((s, v) => s + v, 0);
  if (grandTotal === 0) return [];
  return [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([category, amount]) => ({ category, kes: amount, pct: Math.round((amount / grandTotal) * 100) }))
    .sort((a, b) => b.kes - a.kes);
}

export function categoryDisplayLabel(category: PaymentCategory): string {
  switch (category) {
    case "rent":
      return "Rent";
    case "tokens":
      return "Tokens";
    case "service":
      return "Service";
    case "shop":
      return "Shop";
    case "deposit":
      return "Deposit";
  }
}

// ---------- Recent activity -----------------------------------------------------

export type ActivityItem =
  | {
      kind: "payment";
      id: string;
      createdAt: string;
      amountKes: number;
      method: PaymentMethod;
      category: PaymentCategory;
      status: PaymentStatus;
      tenantName: string | null;
    }
  | {
      kind: "token";
      id: string;
      createdAt: string;
      amountKes: number;
      meterNo: string;
      source: TokenSource;
      deliveryStatus: TokenDeliveryStatus;
      tenantName: string | null;
    };

/** Merges both sources, sorts by createdAt desc, returns the first `limit`. */
export function buildRecentActivity(
  payments: PaymentRow[],
  tokenPurchases: TokenPurchaseRow[],
  tenantNamesById: Map<string, string>,
  limit: number
): ActivityItem[] {
  const paymentItems: ActivityItem[] = payments.map((p) => ({
    kind: "payment",
    id: p.id,
    createdAt: p.created_at,
    amountKes: kes(p.amount_kes),
    method: p.method,
    category: p.category,
    status: p.status,
    tenantName: p.tenant_id ? (tenantNamesById.get(p.tenant_id) ?? null) : null,
  }));
  const tokenItems: ActivityItem[] = tokenPurchases.map((t) => ({
    kind: "token",
    id: t.id,
    createdAt: t.created_at,
    amountKes: kes(t.amount_kes),
    meterNo: t.meter_no,
    source: t.source,
    deliveryStatus: t.delivery_status,
    tenantName: t.tenant_id ? (tenantNamesById.get(t.tenant_id) ?? null) : null,
  }));
  return [...paymentItems, ...tokenItems]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .slice(0, limit);
}

/**
 * "{n}m ago" (< 1h, "just now" under 1 minute), "{n}h ago" (< 24h),
 * "{n}d ago" (1-6 days); at 7+ days falls back to a short date, e.g. "Jul 28".
 */
export function formatRelativeTime(iso: string, now: Date): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
  const day = date.getDate();
  return `${month} ${day}`;
}
