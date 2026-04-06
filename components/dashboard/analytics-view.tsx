"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Download,
  Gauge,
  LineChart,
  Minus,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  ANALYTICS_PERIOD_LABELS,
  buildDailyAnalyticsSeries,
  getAnalyticsKpis,
  getAnalyticsWindow,
  getCategorySplitForWindow,
  getCompletedPayments,
  getLandlordCollectionRanks,
  type AnalyticsPeriod,
} from "@/lib/analytics-data";
import { getMeterFleetReport } from "@/lib/reports-data";
import { getBasePurchasedTokenRows, readStoredManualPurchases, type TokenPurchaseRow } from "@/lib/tokens-data";
import { formatKes } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const PERIOD_OPTIONS: { key: AnalyticsPeriod; short: string }[] = [
  { key: "7d", short: "7d" },
  { key: "30d", short: "30d" },
  { key: "90d", short: "90d" },
  { key: "all", short: "All" },
];

function mergeTokenLedger(): TokenPurchaseRow[] {
  const base = getBasePurchasedTokenRows();
  const stored = readStoredManualPurchases();
  const seen = new Set<string>();
  const out: TokenPurchaseRow[] = [];
  for (const r of [...stored, ...base]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function kesTooltip(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return formatKes(Number.isFinite(n) ? n : 0);
}

function DeltaBadge({ delta }: { delta: ReturnType<typeof getAnalyticsKpis>["deltaCollection"] }) {
  if (!delta) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const up = delta.value > 0;
  const down = delta.value < 0;
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
        up && "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
        down && "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
        !up && !down && "bg-muted text-muted-foreground"
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {delta.label} vs prior
    </span>
  );
}

export function AnalyticsView() {
  const pathname = usePathname();
  const chartId = useId();
  const stackId = useId();

  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");

  const tokenRows = useMemo(() => mergeTokenLedger(), [pathname]);
  const completedPayments = useMemo(() => getCompletedPayments(), []);

  const window = useMemo(() => getAnalyticsWindow(period), [period]);

  const kpis = useMemo(
    () => getAnalyticsKpis(period, completedPayments, tokenRows),
    [period, completedPayments, tokenRows]
  );

  const daily = useMemo(
    () => buildDailyAnalyticsSeries(completedPayments, tokenRows, window.start, window.end),
    [period, completedPayments, tokenRows, window.start, window.end]
  );

  const categorySplit = useMemo(
    () => getCategorySplitForWindow(completedPayments, window.start, window.end),
    [completedPayments, window.start, window.end]
  );

  const landlordRanks = useMemo(
    () => getLandlordCollectionRanks(completedPayments, window.start, window.end, 10),
    [completedPayments, window.start, window.end]
  );

  const fleet = useMemo(() => getMeterFleetReport(), []);

  const pieData = useMemo(
    () => categorySplit.filter((c) => c.amountKes > 0).map((c) => ({ name: c.label, value: c.amountKes, fill: c.fill })),
    [categorySplit]
  );

  function exportCsv() {
    const header = [
      "day",
      "collection_kes",
      "rent_kes",
      "tokens_kes",
      "service_kes",
      "token_purchase_kes",
      "tx_count",
    ].join(",");
    const lines = daily.map((r) =>
      [r.dayKey, r.collectionKes, r.rentKes, r.tokensKes, r.serviceKes, r.tokenPurchaseKes, r.txCount].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartone-analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported daily series", { description: "CSV includes one row per day in the selected range." });
  }

  function exportJsonSnapshot() {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      period,
      periodLabel: ANALYTICS_PERIOD_LABELS[period],
      window: { start: window.start.toISOString(), end: window.end.toISOString() },
      kpis: kpis.current,
      vsPrior: kpis.previous,
      deltas: {
        collection: kpis.deltaCollection,
        tokens: kpis.deltaTokens,
        transactions: kpis.deltaTx,
        avgDaily: kpis.deltaAvgDaily,
      },
      daily,
      categorySplit,
      landlordRanks,
      meterFleet: fleet,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartone-analytics-${period}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Snapshot downloaded", { description: "JSON includes KPIs, series, and rankings." });
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">Analytics</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Interactive trends and breakdowns from the same mock ledgers as Payments and Tokens. Choose a period to compare
            against the immediately preceding window of equal length. Demo data anchored to Apr 2026.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={exportCsv}>
            <Download className="size-4" aria-hidden />
            CSV (daily)
          </Button>
          <Button type="button" variant="outline" className="gap-2 rounded-full" onClick={exportJsonSnapshot}>
            <Download className="size-4" aria-hidden />
            JSON snapshot
          </Button>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Analytics time range"
      >
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        {PERIOD_OPTIONS.map(({ key, short }) => {
          const active = period === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted dark:border-border/80"
              )}
              aria-pressed={active}
            >
              {short}
            </button>
          );
        })}
        <span className="text-sm text-muted-foreground">{ANALYTICS_PERIOD_LABELS[period]}</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-xs font-medium text-muted-foreground">Completed collections</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{formatKes(kpis.current.collectionKes)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <DeltaBadge delta={kpis.deltaCollection} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-xs font-medium text-muted-foreground">Avg daily collection</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{formatKes(kpis.current.avgDailyCollectionKes)}</p>
          <div className="mt-2">
            <DeltaBadge delta={kpis.deltaAvgDaily} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-xs font-medium text-muted-foreground">Token purchase volume</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{formatKes(kpis.current.tokenVolumeKes)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{kpis.current.tokenPurchases} purchases in range</p>
          <div className="mt-2">
            <DeltaBadge delta={kpis.deltaTokens} />
          </div>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-xs font-medium text-muted-foreground">Completed payment txs</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kpis.current.completedTx}</p>
          <div className="mt-2">
            <DeltaBadge delta={kpis.deltaTx} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <LineChart className="size-4 text-muted-foreground" aria-hidden />
                Collections &amp; token purchases
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Per day in range — tenant payments vs STS ledger volume</p>
            </div>
          </div>
          <div className="h-[300px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${chartId}-coll`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0A4266" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#0A4266" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(value, name) => [kesTooltip(value), String(name)]}
                  labelFormatter={(l) => String(l)}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }}
                />
                <Area
                  type="monotone"
                  dataKey="collectionKes"
                  name="Collections"
                  stroke="#0A4266"
                  strokeWidth={2}
                  fill={`url(#${chartId}-coll)`}
                />
                <Line
                  type="monotone"
                  dataKey="tokenPurchaseKes"
                  name="Token purchases"
                  stroke="#059669"
                  strokeWidth={2}
                  dot={false}
                />
                <Legend />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
          <div className="mb-4 flex items-center gap-2">
            <Gauge className="size-4 text-muted-foreground" aria-hidden />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Meter fleet</h2>
              <p className="text-xs text-muted-foreground">Snapshot (not period-filtered)</p>
            </div>
          </div>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between border-b border-border pb-2 dark:border-border/80">
              <span className="text-muted-foreground">Online</span>
              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                {fleet.online}/{fleet.total}
              </span>
            </li>
            <li className="flex justify-between border-b border-border pb-2 dark:border-border/80">
              <span className="text-muted-foreground">Needs attention</span>
              <span className="font-semibold tabular-nums text-amber-800 dark:text-amber-200">{fleet.needsAttention}</span>
            </li>
            <li className="flex justify-between">
              <span className="text-muted-foreground">Offline</span>
              <span className="font-semibold tabular-nums">{fleet.offline}</span>
            </li>
          </ul>
          <Link
            href="/dashboard/meters"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4 w-full rounded-full")}
          >
            Open meters
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
            Payment mix over time
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">Rent vs water tokens vs service — completed tenant payments</p>
          <div className="h-[280px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`${stackId}-r`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id={`${stackId}-t`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id={`${stackId}-s`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d97706" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#d97706" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => kesTooltip(v)} contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)" }} />
                <Area type="monotone" dataKey="rentKes" name="Rent" stackId="1" stroke="#7c3aed" fill={`url(#${stackId}-r)`} />
                <Area type="monotone" dataKey="tokensKes" name="Tokens" stackId="1" stroke="#059669" fill={`url(#${stackId}-t)`} />
                <Area type="monotone" dataKey="serviceKes" name="Service" stackId="1" stroke="#d97706" fill={`url(#${stackId}-s)`} />
                <Legend />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
              Volume by category
            </h2>
            <div className="h-[220px] w-full min-w-0">
              {pieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No volume in this range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pieData.map((d) => ({ name: d.name, value: d.value }))} layout="vertical" margin={{ left: 4, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={kesTooltip} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Share of period</h2>
            <div className="h-[220px] w-full min-w-0">
              {pieData.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No volume in this range
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={kesTooltip} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border bg-muted/30 px-5 py-4 dark:border-border/80">
          <h2 className="text-base font-semibold text-foreground">Landlords by collection volume</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completed payments from tenants mapped to landlord accounts — {ANALYTICS_PERIOD_LABELS[period].toLowerCase()}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b-2 border-[#0A4266]/15 bg-muted/40 dark:border-[#6BB4E8]/20">
                <th className="px-5 py-3 font-semibold text-foreground">#</th>
                <th className="px-5 py-3 font-semibold text-foreground">Landlord</th>
                <th className="px-5 py-3 font-semibold text-foreground">Volume</th>
                <th className="px-5 py-3 font-semibold text-foreground">Share</th>
                <th className="px-5 py-3 text-right font-semibold text-foreground">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/80">
              {landlordRanks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">
                    No completed payments in this range.
                  </td>
                </tr>
              ) : (
                landlordRanks.map((row, i) => (
                  <tr key={row.landlordId} className="hover:bg-muted/40">
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{i + 1}</td>
                    <td className="px-5 py-3 font-medium text-foreground">{row.company}</td>
                    <td className="px-5 py-3 tabular-nums">{formatKes(row.amountKes)}</td>
                    <td className="px-5 py-3 tabular-nums text-muted-foreground">{row.sharePct}%</td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/dashboard/landlords/${encodeURIComponent(row.landlordId)}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-dashed border-border bg-muted/20 p-4 dark:border-border/80">
        <span className="text-sm font-medium text-foreground">Related:</span>
        <Link href="/dashboard/reports" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
          Reports hub
        </Link>
        <Link href="/dashboard/payments" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
          Payments
        </Link>
        <Link href="/dashboard/tokens" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
          Tokens
        </Link>
      </div>
    </div>
  );
}
