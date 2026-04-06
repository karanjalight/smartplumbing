/**
 * Time-series and period aggregates for the Analytics dashboard.
 * Uses the same mock ledgers as Payments, Tokens, and portfolio data.
 */

import { getLandlordRows } from "@/lib/landlords-data";
import {
  buildInitialDashboardPayments,
  type DashboardPayment,
  type PaymentCategory,
} from "@/lib/payments-data";
import { MOCK_TENANTS } from "@/lib/tenants-data";
import type { TokenPurchaseRow } from "@/lib/tokens-data";

export type AnalyticsPeriod = "7d" | "30d" | "90d" | "all";

/** Demo “as of” instant — matches payments-data anchor. */
const ANCHOR_END = new Date("2026-04-05T23:59:59.999Z");

const PERIOD_DAYS: Record<Exclude<AnalyticsPeriod, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function tenantToLandlordId(): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of MOCK_TENANTS) m.set(t.id, t.landlordId);
  return m;
}

/** Parse mock token `createdAt` like `2026-04-05 14:20:33` as UTC. */
export function parseTokenTimestamp(createdAt: string): Date {
  const m = createdAt.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);
  if (m) return new Date(`${m[1]}T${m[2]}.000Z`);
  const d = new Date(createdAt);
  return Number.isFinite(d.getTime()) ? d : new Date(0);
}

function dateKeyUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function getCompletedPayments(): DashboardPayment[] {
  return buildInitialDashboardPayments().filter((p) => p.status === "completed");
}

/** Inclusive UTC day range for the selected analytics window. */
export function getAnalyticsWindow(period: AnalyticsPeriod): { start: Date; end: Date } {
  const end = new Date(ANCHOR_END);
  if (period === "all") {
    const completed = getCompletedPayments();
    let minMs = end.getTime();
    for (const p of completed) {
      const t = new Date(p.createdAtIso).getTime();
      if (t < minMs) minMs = t;
    }
    const start = new Date(minMs);
    start.setUTCHours(0, 0, 0, 0);
    return { start, end };
  }
  const days = PERIOD_DAYS[period];
  const start = new Date(end.getTime() - days * 86_400_000);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
}

export function getComparisonWindow(current: { start: Date; end: Date }): { start: Date; end: Date } | null {
  const span = current.end.getTime() - current.start.getTime();
  if (span <= 0) return null;
  const prevEnd = new Date(current.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - span);
  return { start: prevStart, end: prevEnd };
}

function paymentsInWindow(
  payments: DashboardPayment[],
  start: Date,
  end: Date
): DashboardPayment[] {
  return payments.filter((p) => {
    const t = new Date(p.createdAtIso);
    return t >= start && t <= end;
  });
}

function tokensInWindow(rows: TokenPurchaseRow[], start: Date, end: Date): TokenPurchaseRow[] {
  return rows.filter((r) => {
    const t = parseTokenTimestamp(r.createdAt);
    return t >= start && t <= end;
  });
}

function eachUtcDayInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  const cap = new Date(end);
  cap.setUTCHours(23, 59, 59, 999);
  while (d.getTime() <= cap.getTime()) {
    out.push(new Date(d));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export type PeriodTotals = {
  collectionKes: number;
  completedTx: number;
  tokenVolumeKes: number;
  tokenPurchases: number;
  avgDailyCollectionKes: number;
  /** Inclusive calendar days in the window. */
  dayCount: number;
};

function sumPeriod(
  payments: DashboardPayment[],
  tokenRows: TokenPurchaseRow[],
  start: Date,
  end: Date
): PeriodTotals {
  const pIn = paymentsInWindow(payments, start, end);
  const tIn = tokensInWindow(tokenRows, start, end);
  const collectionKes = pIn.reduce((s, p) => s + p.amountKes, 0);
  const tokenVolumeKes = tIn.reduce((s, r) => s + r.amountKes, 0);
  const spanDays = Math.max(1, eachUtcDayInclusive(start, end).length);
  const avgDailyCollectionKes = collectionKes / spanDays;
  return {
    collectionKes,
    completedTx: pIn.length,
    tokenVolumeKes,
    tokenPurchases: tIn.length,
    avgDailyCollectionKes,
    dayCount: spanDays,
  };
}

export type DeltaPct = { value: number; label: string } | null;

function pctDelta(current: number, previous: number): DeltaPct {
  if (previous === 0) {
    if (current === 0) return { value: 0, label: "0%" };
    return { value: 100, label: "+100%" };
  }
  const raw = ((current - previous) / previous) * 100;
  const rounded = Math.round(raw * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return { value: rounded, label: `${sign}${rounded}%` };
}

export type AnalyticsKpis = {
  current: PeriodTotals;
  previous: PeriodTotals | null;
  deltaCollection: DeltaPct;
  deltaTokens: DeltaPct;
  deltaTx: DeltaPct;
  deltaAvgDaily: DeltaPct;
};

export function getAnalyticsKpis(
  period: AnalyticsPeriod,
  payments: DashboardPayment[],
  tokenRows: TokenPurchaseRow[]
): AnalyticsKpis {
  const win = getAnalyticsWindow(period);
  const current = sumPeriod(payments, tokenRows, win.start, win.end);
  const prevBounds = getComparisonWindow(win);
  const previous = prevBounds ? sumPeriod(payments, tokenRows, prevBounds.start, prevBounds.end) : null;

  return {
    current,
    previous,
    deltaCollection: previous ? pctDelta(current.collectionKes, previous.collectionKes) : null,
    deltaTokens: previous ? pctDelta(current.tokenVolumeKes, previous.tokenVolumeKes) : null,
    deltaTx: previous ? pctDelta(current.completedTx, previous.completedTx) : null,
    deltaAvgDaily: previous ? pctDelta(current.avgDailyCollectionKes, previous.avgDailyCollectionKes) : null,
  };
}

export type DailyAnalyticsPoint = {
  dayKey: string;
  label: string;
  collectionKes: number;
  rentKes: number;
  tokensKes: number;
  serviceKes: number;
  tokenPurchaseKes: number;
  txCount: number;
};

/** Daily series for charts; buckets completed payments and token purchases by UTC day. */
export function buildDailyAnalyticsSeries(
  payments: DashboardPayment[],
  tokenRows: TokenPurchaseRow[],
  start: Date,
  end: Date
): DailyAnalyticsPoint[] {
  const days = eachUtcDayInclusive(start, end);
  const byDay = new Map<
    string,
    {
      collectionKes: number;
      rentKes: number;
      tokensKes: number;
      serviceKes: number;
      tokenPurchaseKes: number;
      txCount: number;
    }
  >();

  for (const day of days) {
    byDay.set(dateKeyUtc(day), {
      collectionKes: 0,
      rentKes: 0,
      tokensKes: 0,
      serviceKes: 0,
      tokenPurchaseKes: 0,
      txCount: 0,
    });
  }

  const pIn = paymentsInWindow(payments, start, end);
  for (const p of pIn) {
    const key = dateKeyUtc(new Date(p.createdAtIso));
    const cell = byDay.get(key);
    if (!cell) continue;
    cell.collectionKes += p.amountKes;
    cell.txCount += 1;
    if (p.category === "rent") cell.rentKes += p.amountKes;
    else if (p.category === "tokens") cell.tokensKes += p.amountKes;
    else cell.serviceKes += p.amountKes;
  }

  const tIn = tokensInWindow(tokenRows, start, end);
  for (const r of tIn) {
    const key = dateKeyUtc(parseTokenTimestamp(r.createdAt));
    const cell = byDay.get(key);
    if (!cell) continue;
    cell.tokenPurchaseKes += r.amountKes;
  }

  return days.map((day) => {
    const dayKey = dateKeyUtc(day);
    const c = byDay.get(dayKey)!;
    return {
      dayKey,
      label: day.toLocaleDateString("en-KE", { month: "short", day: "numeric", timeZone: "UTC" }),
      collectionKes: c.collectionKes,
      rentKes: c.rentKes,
      tokensKes: c.tokensKes,
      serviceKes: c.serviceKes,
      tokenPurchaseKes: c.tokenPurchaseKes,
      txCount: c.txCount,
    };
  });
}

export type LandlordCollectionRank = {
  landlordId: string;
  company: string;
  amountKes: number;
  sharePct: number;
};

/** Rank landlords by completed payment volume from their tenants in the window. */
export function getLandlordCollectionRanks(
  payments: DashboardPayment[],
  start: Date,
  end: Date,
  limit = 8
): LandlordCollectionRank[] {
  const map = tenantToLandlordId();
  const landlords = getLandlordRows();
  const companyById = new Map(landlords.map((l) => [l.id, l.company] as const));

  const agg = new Map<string, number>();
  for (const p of paymentsInWindow(payments, start, end)) {
    const lid = map.get(p.tenantId);
    if (!lid) continue;
    agg.set(lid, (agg.get(lid) ?? 0) + p.amountKes);
  }

  const sorted = Array.from(agg.entries())
    .map(([landlordId, amountKes]) => ({
      landlordId,
      company: companyById.get(landlordId) ?? landlordId,
      amountKes,
    }))
    .sort((a, b) => b.amountKes - a.amountKes)
    .slice(0, limit);

  const total = sorted.reduce((s, r) => s + r.amountKes, 0) || 1;
  return sorted.map((r) => ({
    ...r,
    sharePct: Math.round((r.amountKes / total) * 1000) / 10,
  }));
}

export type CategorySplitRow = {
  category: PaymentCategory;
  label: string;
  amountKes: number;
  fill: string;
};

const CAT_META: Record<PaymentCategory, { label: string; fill: string }> = {
  rent: { label: "Rent", fill: "#7c3aed" },
  tokens: { label: "Tokens (water)", fill: "#059669" },
  service: { label: "Service", fill: "#d97706" },
};

export function getCategorySplitForWindow(
  payments: DashboardPayment[],
  start: Date,
  end: Date
): CategorySplitRow[] {
  const pIn = paymentsInWindow(payments, start, end);
  const sums: Record<PaymentCategory, number> = { rent: 0, tokens: 0, service: 0 };
  for (const p of pIn) sums[p.category] += p.amountKes;
  return (["rent", "tokens", "service"] as const).map((category) => ({
    category,
    label: CAT_META[category].label,
    amountKes: sums[category],
    fill: CAT_META[category].fill,
  }));
}

export const ANALYTICS_PERIOD_LABELS: Record<AnalyticsPeriod, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All available data",
};
