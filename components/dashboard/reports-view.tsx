"use client";

import {
  Building2,
  ClipboardList,
  Download,
  Droplets,
  Gauge,
  Home,
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

import { Button, buttonVariants } from "@/components/ui/button";
import {
  aggregateTokenPurchases,
  getMeterFleetReport,
  getOverviewMetrics,
  getPayoutReport,
  getPortfolioReport,
  getRevenueReport,
  PLATFORM_FEE_RATE,
} from "@/lib/reports-data";
import { getBasePurchasedTokenRows, readStoredManualPurchases, type TokenPurchaseRow } from "@/lib/tokens-data";
import { cn } from "@/lib/utils";

const DEMO_AS_OF = "Apr 2026 (demo data)";

const TABS = [
  { id: "overview" as const, label: "Overview", Icon: LayoutDashboard, description: "KPIs across billing, payouts, and fleet" },
  { id: "revenue" as const, label: "Revenue & collections", Icon: TrendingUp, description: "Tenant payments by type and channel" },
  { id: "payouts" as const, label: "Landlord payouts", Icon: Wallet, description: "Net settlements and rails" },
  { id: "tokens" as const, label: "Tokens & vending", Icon: Ticket, description: "STS purchases by source" },
  { id: "meters" as const, label: "Meters & health", Icon: Gauge, description: "Connectivity and device status" },
  { id: "portfolio" as const, label: "Portfolio", Icon: Building2, description: "Tenants, landlords, buildings" },
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

function kFmt(n: number) {
  return `${n.toLocaleString("en-KE")} KES`;
}

function kesTooltipValue(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return kFmt(Number.isFinite(n) ? n : 0);
}

export function ReportsView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");

  const tokenRows = useMemo(() => mergeTokenLedger(), []);
  const tokenReport = useMemo(() => aggregateTokenPurchases(tokenRows), [tokenRows]);
  const revenue = useMemo(() => getRevenueReport(), []);
  const payout = useMemo(() => getPayoutReport(), []);
  const fleet = useMemo(() => getMeterFleetReport(), []);
  const portfolio = useMemo(() => getPortfolioReport(), []);
  const overview = useMemo(
    () => getOverviewMetrics(tokenReport.volumeKes, tokenReport.count),
    [tokenReport]
  );

  function exportSnapshot() {
    const snapshot = {
      generatedAt: new Date().toISOString(),
      asOf: DEMO_AS_OF,
      overview,
      revenue,
      payout: {
        ...payout,
        recent: payout.recent.map((r) => ({ ...r, scheduledAtIso: r.scheduledAtIso, paidAtIso: r.paidAtIso })),
      },
      tokenPurchases: tokenReport,
      meterFleet: fleet,
      portfolio,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartone-reports-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report snapshot downloaded", { description: "JSON includes all tab aggregates." });
  }

  const methodChartData = revenue.byMethod.map((m) => ({ name: m.label, value: m.amountKes }));
  const railChartData = payout.netByRail.filter((r) => r.netKes > 0).map((r) => ({ name: r.label, value: r.netKes }));
  const tokenSourceData = tokenReport.bySource.filter((s) => s.volumeKes > 0 || s.count > 0);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">Reports</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Cross-cutting operational and financial reporting for Smart Plumbing admin. Data is derived from the same mock
            sources as Payments, Payouts, Tokens, and Meters. {DEMO_AS_OF}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" className="rounded-full gap-2" onClick={exportSnapshot}>
            <Download className="size-4" />
            Export snapshot (JSON)
          </Button>
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15" aria-hidden>
            <ClipboardList className="size-8 text-[#0A4266] dark:text-[#6BB4E8]" />
          </div>
        </div>
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
              id={`report-tab-${id}`}
              aria-controls={`report-panel-${id}`}
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
          id="report-panel-overview"
          aria-labelledby="report-tab-overview"
          className="space-y-6"
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
              <p className="text-xs font-medium text-muted-foreground">Collections (completed)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kFmt(overview.completedCollectionKes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">Tenant-side payments in mock ledger</p>
            </div>
            <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
              <p className="text-xs font-medium text-muted-foreground">Net payouts (completed)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kFmt(overview.netPayoutsCompletedKes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">To landlords after {Math.round(PLATFORM_FEE_RATE * 100)}% fee</p>
            </div>
            <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
              <p className="text-xs font-medium text-muted-foreground">Token purchase volume</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{kFmt(overview.tokenVolumeKes)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{overview.tokensPurchasedCount} purchases (includes browser queue)</p>
            </div>
            <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
              <p className="text-xs font-medium text-muted-foreground">Meters online</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{overview.meterOnlinePct}%</p>
              <p className="mt-1 text-xs text-muted-foreground">{overview.pendingPaymentCount} payments pending · {kFmt(overview.pendingPayoutKes)} payout pending</p>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm dark:border-border/80">
              <h2 className="text-sm font-semibold text-foreground">Quick links</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                <li>
                  <Link href="/dashboard/payments" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                    Payments
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/payouts" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                    Payouts
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/tokens" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                    Tokens
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard/meters" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                    Meters
                  </Link>
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-5 dark:border-border/80">
              <p className="text-sm font-medium text-foreground">How to use</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Switch tabs for drill-down charts and tables. Export snapshot downloads all aggregates as JSON for
                hand-off to finance or BI tools.
              </p>
            </div>
          </div>
        </section>
      )}

      {tab === "revenue" && (
        <section role="tabpanel" id="report-panel-revenue" aria-labelledby="report-tab-revenue" className="space-y-6">
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
              <p className="text-xs text-muted-foreground">Top tenant share (of top 10)</p>
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
              <h3 className="text-sm font-semibold text-foreground">Top tenants by volume (completed)</h3>
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
                  {revenue.topTenants.map((t, i) => (
                    <tr key={t.tenantId} className="hover:bg-muted/40">
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2 font-medium text-foreground">{t.tenantName}</td>
                      <td className="px-4 py-2 tabular-nums">{kFmt(t.amountKes)}</td>
                      <td className="px-4 py-2 tabular-nums text-muted-foreground">{t.sharePct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {tab === "payouts" && (
        <section role="tabpanel" id="report-panel-payouts" aria-labelledby="report-tab-payouts" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Gross to settle</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{kFmt(payout.totalGrossKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Platform fees</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{kFmt(payout.totalFeeKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Net to landlords</p>
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
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Reference</th>
                    <th className="px-4 py-2 font-medium">Landlord</th>
                    <th className="px-4 py-2 font-medium">Period</th>
                    <th className="px-4 py-2 font-medium">Net</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {payout.recent.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2 font-mono text-xs">{r.reference}</td>
                      <td className="px-4 py-2">{r.company}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{r.periodLabel}</td>
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
        <section role="tabpanel" id="report-panel-tokens" aria-labelledby="report-tab-tokens" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Purchases in ledger</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{tokenReport.count}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Total volume</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{kFmt(tokenReport.volumeKes)}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Manual rows (browser)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{readStoredManualPurchases().length}</p>
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
          <p className="text-xs text-muted-foreground">
            Aligns with PROJECT_PROPOSAL / LONGi vending: M-Pesa and app self-service, plus manual office issuance. Token ledger
            merges demo data with any manual rows queued from Manual Tokens in this browser.
          </p>
        </section>
      )}

      {tab === "meters" && (
        <section role="tabpanel" id="report-panel-meters" aria-labelledby="report-tab-meters" className="space-y-6">
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
          <Link href="/dashboard/meters" className={cn(buttonVariants({ variant: "outline" }), "inline-flex rounded-full")}>
            Open meter inventory
          </Link>
        </section>
      )}

      {tab === "portfolio" && (
        <section role="tabpanel" id="report-panel-portfolio" aria-labelledby="report-tab-portfolio" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="size-3.5" aria-hidden />
                Tenants
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{portfolio.tenantCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Active landlords</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">
                {portfolio.landlordActive}/{portfolio.landlordCount}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Buildings</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{portfolio.buildingCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <p className="text-xs text-muted-foreground">Units (approx.)</p>
              <p className="mt-1 text-2xl font-bold tabular-nums">{portfolio.totalUnitsApprox}</p>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Tenant status</h3>
              <div className="h-[220px] w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Active", value: portfolio.tenantByStatus.active },
                      { name: "Low credit", value: portfolio.tenantByStatus.low_credit },
                      { name: "Inactive", value: portfolio.tenantByStatus.inactive },
                      { name: "Overdue", value: portfolio.tenantByStatus.overdue },
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
                  <Link className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]" href="/dashboard/tenants">
                    Tenants directory
                  </Link>
                </li>
                <li>
                  <Link className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]" href="/dashboard/landlords">
                    Landlords directory
                  </Link>
                </li>
                <li>
                  <Link className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]" href="/dashboard/buildings">
                    Buildings
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
