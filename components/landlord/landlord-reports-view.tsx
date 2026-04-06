"use client";

import {
  Building2,
  ClipboardList,
  Download,
  Droplets,
  Gauge,
  LayoutDashboard,
  PieChart as PieChartIcon,
  Ticket,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { useLandlordFinanceStore } from "@/components/landlord/use-landlord-finance-store";
import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  buildLandlordReportsBundle,
  LANDLORD_REPORT_PERIOD_OPTIONS,
  type LandlordReportPeriod,
} from "@/lib/landlord-reports-data";
import { PLATFORM_FEE_RATE } from "@/lib/reports-data";
import { readStoredManualPurchases } from "@/lib/tokens-data";
import { cn } from "@/lib/utils";

const DEMO_AS_OF_LABEL = "Demo data through Apr 2026 · scoped to your portfolio";

const TABS = [
  { id: "overview" as const, label: "Overview", Icon: LayoutDashboard, description: "KPIs for your account" },
  { id: "revenue" as const, label: "Collections", Icon: TrendingUp, description: "Tenant payments by type and channel" },
  { id: "payouts" as const, label: "Payouts", Icon: Wallet, description: "Settlements to you" },
  { id: "tokens" as const, label: "Tokens", Icon: Ticket, description: "STS purchases for your meters" },
  { id: "meters" as const, label: "Meters", Icon: Gauge, description: "Fleet health" },
  { id: "properties" as const, label: "Properties", Icon: Building2, description: "Buildings, tenants, tariffs" },
];

function kFmt(n: number) {
  return `${n.toLocaleString("en-KE")} KES`;
}

function kesTooltipValue(v: unknown) {
  const num = typeof v === "number" ? v : Number(v);
  return kFmt(Number.isFinite(num) ? num : 0);
}

export function LandlordReportsView({ landlordId }: { landlordId: string }) {
  const portfolio = useLandlordPortfolioStore();
  const finance = useLandlordFinanceStore();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [period, setPeriod] = useState<LandlordReportPeriod>("30d");

  const bundle = useMemo(() => {
    if (!portfolio || !finance) return null;
    return buildLandlordReportsBundle(landlordId, portfolio, finance, period);
  }, [landlordId, portfolio, finance, period]);

  const manualTokenCount = useMemo(() => readStoredManualPurchases().length, []);

  function exportSnapshotJson() {
    if (!bundle || !portfolio || !finance) return;
    const snapshot = {
      generatedAt: new Date().toISOString(),
      landlordId,
      period,
      label: DEMO_AS_OF_LABEL,
      overview: bundle.overview,
      revenue: bundle.revenue,
      payout: {
        ...bundle.payout,
        recent: bundle.payout.recent.map((r) => ({
          ...r,
          scheduledAtIso: r.scheduledAtIso,
          paidAtIso: r.paidAtIso,
        })),
      },
      tokenPurchases: bundle.tokenReport,
      meterFleet: bundle.fleet,
      properties: bundle.properties,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `landlord-reports-${landlordId}-${period}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report snapshot downloaded", { description: "JSON includes all tab aggregates for this period." });
  }

  function exportRevenueCsv() {
    if (!bundle) return;
    const lines = [
      ["Section", "Label", "Value (KES)", "Notes"].join(","),
      ["Completed volume", "Total", String(bundle.revenue.completedVolumeKes), `${bundle.revenue.completedCount} tx`].join(
        ","
      ),
      ...bundle.revenue.byCategory.map((c) =>
        ["By category", c.label, String(c.amountKes), c.category].join(",")
      ),
      ...bundle.revenue.byMethod.map((m) => ["By method", m.label, String(m.amountKes), m.method].join(",")),
      ...bundle.revenue.topTenants.map((t, i) =>
        ["Top tenant", t.tenantName, String(t.amountKes), `#${i + 1} share ${t.sharePct}%`].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `landlord-collections-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Collections CSV exported");
  }

  if (portfolio === null || finance === null) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Loading reports…
      </div>
    );
  }

  if (!bundle) {
    return null;
  }

  const { revenue, payout, tokenReport, fleet, properties, overview } = bundle;

  const methodChartData = revenue.byMethod.map((m) => ({ name: m.label, value: m.amountKes }));
  const railChartData = payout.netByRail.filter((r) => r.netKes > 0).map((r) => ({ name: r.label, value: r.netKes }));
  const tokenSourceData = tokenReport.bySource.filter((s) => s.volumeKes > 0 || s.count > 0);

  const periodLabel = LANDLORD_REPORT_PERIOD_OPTIONS.find((o) => o.key === period)?.label ?? period;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">Reports</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Operational and financial summaries for your portfolio: tenant collections, platform payouts to you, STS token
            vending, and meter fleet status. Data merges demo seed rows with portfolio and finance changes stored in this
            browser. {DEMO_AS_OF_LABEL}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="rounded-full gap-2" onClick={exportSnapshotJson}>
            <Download className="size-4" />
            Export snapshot (JSON)
          </Button>
          <div
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15"
            aria-hidden
          >
            <ClipboardList className="size-8 text-[#0A4266] dark:text-[#6BB4E8]" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4 dark:border-border/80 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Label htmlFor="landlord-report-period" className="text-xs font-medium text-muted-foreground">
            Report period
          </Label>
          <select
            id="landlord-report-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as LandlordReportPeriod)}
            className="flex h-10 min-w-[200px] rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
          >
            {LANDLORD_REPORT_PERIOD_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <p className="max-w-xl text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Active filter: {periodLabel}.</span> Applies to tenant payment
          timestamps, payout batch schedule dates, and token purchase times. Meter and property tabs are point-in-time
          snapshots.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Report categories"
        className="flex flex-wrap gap-2 border-b border-border pb-3 dark:border-border/80"
      >
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              id={`landlord-report-tab-${id}`}
              aria-controls={`landlord-report-panel-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted dark:border-border/80"
              )}
            >
              <Icon className="size-4 shrink-0 opacity-90" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>

      {tab === "overview" && (
        <section
          role="tabpanel"
          id="landlord-report-panel-overview"
          aria-labelledby="landlord-report-tab-overview"
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
              <p className="text-xs font-medium text-muted-foreground">Collections (completed)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kFmt(overview.completedCollectionKes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Your tenants — {periodLabel}</p>
            </div>
            <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
              <p className="text-xs font-medium text-muted-foreground">Net payouts (completed)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kFmt(overview.netPayoutsCompletedKes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">To you after {Math.round(PLATFORM_FEE_RATE * 100)}% platform fee</p>
            </div>
            <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
              <p className="text-xs font-medium text-muted-foreground">Token purchase volume</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kFmt(overview.tokenVolumeKes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{overview.tokensPurchasedCount} purchases in period</p>
            </div>
            <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-muted-foreground">Meters online</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{overview.meterOnlinePct}%</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {overview.pendingPaymentCount} payments pending · {kFmt(overview.pendingPayoutKes)} payout pending
              </p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
              <h2 className="text-sm font-semibold text-foreground">Quick links</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                <li>
                  <Link
                    href="/landlords/dashboard/finance/payments"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                  >
                    Payments
                  </Link>
                </li>
                <li>
                  <Link
                    href="/landlords/dashboard/finance/payouts"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                  >
                    Payouts
                  </Link>
                </li>
                <li>
                  <Link
                    href="/landlords/dashboard/pricing"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                  >
                    Water pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/landlords/dashboard/meters"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                  >
                    Meters
                  </Link>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 dark:border-border/80">
              <p className="text-sm font-medium text-foreground">Using these reports</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Switch tabs for charts and tables. JSON export includes everything for the selected period. For accounting,
                start with Collections, then cross-check Payouts against your bank or M-Pesa B2B statements.
              </p>
            </div>
          </div>
        </section>
      )}

      {tab === "revenue" && (
        <section
          role="tabpanel"
          id="landlord-report-panel-revenue"
          aria-labelledby="landlord-report-tab-revenue"
          className="space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Completed tenant payments only. Edits from <span className="font-medium text-foreground">Record payment</span>{" "}
              on the finance page are included.
            </p>
            <Button type="button" variant="outline" className="rounded-full gap-2" onClick={exportRevenueCsv}>
              <Download className="size-4" />
              Export collections (CSV)
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Completed volume</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{kFmt(revenue.completedVolumeKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{revenue.completedCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Largest share (top 10)</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{revenue.topTenants[0]?.sharePct ?? 0}%</p>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <PieChartIcon className="size-4 text-muted-foreground" aria-hidden />
                By payment type
              </h3>
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenue.byCategory.filter((c) => c.amountKes > 0)}
                      dataKey="amountKes"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {revenue.byCategory.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={kesTooltipValue} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">By payment method</h3>
              <div className="h-[280px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={methodChartData} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={kesTooltipValue} />
                    <Bar dataKey="value" fill="#0A4266" radius={[0, 4, 4, 0]} name="Amount" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
            <div className="border-b border-border px-4 py-3 dark:border-border/80">
              <h3 className="text-sm font-semibold text-foreground">Top tenants by collection (completed)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="px-4 py-2 font-medium">#</th>
                    <th className="px-4 py-2 font-medium">Tenant</th>
                    <th className="px-4 py-2 font-medium">Amount</th>
                    <th className="px-4 py-2 font-medium">Share of top 10</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {revenue.topTenants.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                        No completed payments in this period.
                      </td>
                    </tr>
                  ) : (
                    revenue.topTenants.map((t, i) => (
                      <tr key={t.tenantId} className="hover:bg-muted/40">
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                        <td className="px-4 py-2 font-medium text-foreground">{t.tenantName}</td>
                        <td className="px-4 py-2 tabular-nums">{kFmt(t.amountKes)}</td>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{t.sharePct}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "payouts" && (
        <section
          role="tabpanel"
          id="landlord-report-panel-payouts"
          aria-labelledby="landlord-report-tab-payouts"
          className="space-y-6"
        >
          <p className="text-sm text-muted-foreground">
            Settlement batches attributed to you. Rows created in <span className="font-medium text-foreground">Queue payout</span>{" "}
            are included.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Gross (in period)</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{kFmt(payout.totalGrossKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Platform fees</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{kFmt(payout.totalFeeKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Net (all statuses)</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{kFmt(payout.totalNetKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Completed net</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{kFmt(payout.completedNetKes)}</p>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Net by rail</h3>
              <div className="h-[240px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={railChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={kesTooltipValue} />
                    <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Batch status</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between border-b border-border pb-2 dark:border-border/80">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-semibold tabular-nums">{payout.countByStatus.completed}</span>
                </li>
                <li className="flex justify-between border-b border-border pb-2 dark:border-border/80">
                  <span className="text-muted-foreground">Pending</span>
                  <span className="font-semibold tabular-nums">{payout.countByStatus.pending}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-muted-foreground">Failed</span>
                  <span className="font-semibold tabular-nums">{payout.countByStatus.failed}</span>
                </li>
                <li className="pt-2 text-xs text-muted-foreground">Pending net: {kFmt(payout.pendingNetKes)}</li>
              </ul>
            </div>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
            <div className="border-b border-border px-4 py-3 dark:border-border/80">
              <h3 className="text-sm font-semibold text-foreground">Recent batches</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Reference</th>
                    <th className="px-4 py-2 font-medium">Period</th>
                    <th className="px-4 py-2 font-medium">Net</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payout.recent.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2 font-mono text-xs">{r.reference}</td>
                      <td className="whitespace-nowrap px-4 py-2">{r.periodLabel}</td>
                      <td className="px-4 py-2 tabular-nums">{kFmt(r.netPayoutKes)}</td>
                      <td className="px-4 py-2 capitalize">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "tokens" && (
        <section
          role="tabpanel"
          id="landlord-report-panel-tokens"
          aria-labelledby="landlord-report-tab-tokens"
          className="space-y-6"
        >
          <p className="text-sm text-muted-foreground">
            Token rows whose meter matches one of your tenants. Manual queue rows in this browser:{" "}
            <span className="font-medium text-foreground">{manualTokenCount}</span> total (all landlords).
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Purchases in period</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{tokenReport.count}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Volume</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{kFmt(tokenReport.volumeKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Avg. ticket</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {tokenReport.count ? kFmt(Math.round(tokenReport.volumeKes / tokenReport.count)) : "—"}
              </p>
            </div>
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Droplets className="size-4 text-emerald-600" aria-hidden />
                Volume by source
              </h3>
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={tokenSourceData}
                      dataKey="volumeKes"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={88}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {tokenSourceData.map((_, i) => (
                        <Cell key={i} fill={["#059669", "#0A4266", "#d97706"][i % 3]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={kesTooltipValue} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Counts by source</h3>
              <div className="h-[260px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokenSourceData.map((s) => ({ name: s.label, count: s.count }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0A4266" radius={[4, 4, 0, 0]} name="Purchases" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === "meters" && (
        <section
          role="tabpanel"
          id="landlord-report-panel-meters"
          aria-labelledby="landlord-report-tab-meters"
          className="space-y-6"
        >
          <p className="text-sm text-muted-foreground">
            Point-in-time snapshot of meters linked to your portfolio (including tenants added locally). Not filtered by the
            date range above.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Fleet size</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{fleet.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Online</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{fleet.online}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Needs attention</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-amber-800 dark:text-amber-200">{fleet.needsAttention}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Offline</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{fleet.offline}</p>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Connectivity</h3>
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Online", value: fleet.online },
                        { name: "Intermittent", value: fleet.intermittent },
                        { name: "Offline", value: fleet.offline },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      <Cell fill="#0ea5e9" />
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#f43f5e" />
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Device lifecycle</h3>
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Active", value: fleet.statusActive },
                      { name: "Maintenance", value: fleet.statusMaintenance },
                      { name: "Fault", value: fleet.statusFault },
                      { name: "Inactive", value: fleet.statusInactive },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0A4266" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <Link
            href="/landlords/dashboard/meters"
            className={cn(buttonVariants({ variant: "outline" }), "inline-flex rounded-full")}
          >
            Open meter inventory
          </Link>
        </section>
      )}

      {tab === "properties" && (
        <section
          role="tabpanel"
          id="landlord-report-panel-properties"
          aria-labelledby="landlord-report-tab-properties"
          className="space-y-6"
        >
          <p className="text-sm text-muted-foreground">
            Counts from merged buildings and tenants (demo + your portfolio CRUD). Water pricing count reflects buildings with
            saved tariff overrides.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                Tenants
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{properties.tenantCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="size-3.5" aria-hidden />
                Buildings
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{properties.buildingCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Unit capacity (approx.)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{properties.unitCapacityApprox}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Custom water tariffs</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{properties.waterPricingCustomizedCount}</p>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Tenant status</h3>
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Active", value: properties.tenantByStatus.active },
                      { name: "Low credit", value: properties.tenantByStatus.low_credit },
                      { name: "Inactive", value: properties.tenantByStatus.inactive },
                      { name: "Overdue", value: properties.tenantByStatus.overdue },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#7c3aed" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Links</h3>
              <ul className="flex flex-col gap-2 text-sm">
                <li>
                  <Link
                    className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                    href="/landlords/dashboard/tenants"
                  >
                    Tenants
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                    href="/landlords/dashboard/buildings"
                  >
                    Buildings
                  </Link>
                </li>
                <li>
                  <Link
                    className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                    href="/landlords/dashboard/pricing"
                  >
                    Water pricing
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
