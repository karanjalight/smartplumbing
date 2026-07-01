import type { PaymentStatus } from "@/lib/supabase/types";

export type PortfolioCounts = {
  buildings: number;
  units: number;
  meters: number;
  metersOnline: number;
  tenants: number;
  tenantsActive: number;
};

export function summarizePortfolio(input: {
  buildings: { id: string }[];
  units: { id: string }[];
  meters: { connectivity_status: string | null }[];
  tenants: { status: string | null }[];
}): PortfolioCounts {
  return {
    buildings: input.buildings.length,
    units: input.units.length,
    meters: input.meters.length,
    metersOnline: input.meters.filter((m) => m.connectivity_status === "online").length,
    tenants: input.tenants.length,
    tenantsActive: input.tenants.filter((t) => t.status === "active").length,
  };
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type MonthlyCollection = { month: string; amount: number };
export type CollectionsSummary = {
  series: MonthlyCollection[];
  thisMonthKes: number;
  lastMonthKes: number;
  deltaPct: number | null;
};

export function summarizeCollections(
  payments: { amount_kes: number; created_at: string; status: PaymentStatus }[],
  now: Date,
  months = 6,
): CollectionsSummary {
  // Bucket key = YYYY-M (0-based month) for completed payments only.
  const totals = new Map<string, number>();
  for (const p of payments) {
    if (p.status !== "completed") continue;
    const d = new Date(p.created_at);
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(p.amount_kes));
  }

  const series: MonthlyCollection[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    series.push({ month: MONTH_ABBR[d.getUTCMonth()], amount: totals.get(key) ?? 0 });
  }

  const thisMonthKes = series[series.length - 1]?.amount ?? 0;
  const lastMonthKes = series[series.length - 2]?.amount ?? 0;
  const deltaPct =
    lastMonthKes === 0 ? null : ((thisMonthKes - lastMonthKes) / lastMonthKes) * 100;

  return { series, thisMonthKes, lastMonthKes, deltaPct };
}
