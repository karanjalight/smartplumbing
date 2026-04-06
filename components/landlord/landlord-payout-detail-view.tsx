"use client";

import { ArrowLeft, Building2, Calendar, Landmark, Smartphone, Wallet } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { useMemo } from "react";

import { useLandlordFinanceStore } from "@/components/landlord/use-landlord-finance-store";
import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { buttonVariants } from "@/components/ui/button";
import {
  mergeDashboardPaymentsForLandlord,
  mergePayoutLedgerForLandlord,
} from "@/lib/landlord-finance-storage";
import {
  categoryLabel,
  getCompletedPaymentsForPayoutMonth,
  methodLabel,
  type DashboardPayment,
} from "@/lib/payments-data";
import { railLabel, type PayoutLedgerRow } from "@/lib/payouts-data";
import { cn } from "@/lib/utils";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function payoutStatusBadge(status: PayoutLedgerRow["status"]) {
  const map = {
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    pending: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

export function LandlordPayoutDetailPage({
  payoutId,
  landlordId,
}: {
  payoutId: string;
  landlordId: string;
}) {
  const portfolio = useLandlordPortfolioStore();
  const financeStore = useLandlordFinanceStore();

  const { payout, attributed, paymentsTotal } = useMemo(() => {
    if (!portfolio || !financeStore) {
      return { payout: undefined as PayoutLedgerRow | undefined, attributed: [] as DashboardPayment[], paymentsTotal: 0 };
    }
    const rows = mergePayoutLedgerForLandlord(landlordId, financeStore);
    const p = rows.find((r) => r.id === payoutId);
    if (!p || p.landlordId !== landlordId) {
      return { payout: undefined, attributed: [], paymentsTotal: 0 };
    }
    const allPay = mergeDashboardPaymentsForLandlord(landlordId, portfolio, financeStore);
    const attributed = getCompletedPaymentsForPayoutMonth(allPay, p);
    const paymentsTotal = attributed.reduce((s, x) => s + x.amountKes, 0);
    return { payout: p, attributed, paymentsTotal };
  }, [payoutId, landlordId, portfolio, financeStore]);

  if (portfolio === null || financeStore === null) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Loading payout…</div>
    );
  }

  if (!payout) {
    notFound();
  }

  const variance = payout.grossKes - paymentsTotal;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 border-b border-border pb-6 dark:border-border/80 sm:flex-row sm:items-center sm:gap-4">
        <Link
          href="/landlords/dashboard/finance/payouts"
          aria-label="Back to payouts"
          className={cn(
            buttonVariants({ variant: "outline", size: "icon" }),
            "size-10 shrink-0 rounded-full"
          )}
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Payout batch</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground">{payout.periodLabel}</h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{payout.reference}</p>
        </div>
        <div className="shrink-0">{payoutStatusBadge(payout.status)}</div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Gross attributed</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {payout.grossKes.toLocaleString("en-KE")} <span className="text-base font-semibold">KES</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Before platform fee</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50/80 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/25">
          <p className="text-sm font-medium text-muted-foreground">Platform fee</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {payout.platformFeeKes.toLocaleString("en-KE")} <span className="text-base font-semibold">KES</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50/80 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/25">
          <p className="text-sm font-medium text-muted-foreground">Net payout</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {payout.netPayoutKes.toLocaleString("en-KE")} <span className="text-base font-semibold">KES</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
          <p className="text-sm font-medium text-muted-foreground">Rail</p>
          <p className="mt-1 flex items-center gap-2 font-semibold text-foreground">
            {payout.rail === "m_pesa_b2b" ? (
              <Smartphone className="size-4 text-muted-foreground" aria-hidden />
            ) : (
              <Landmark className="size-4 text-muted-foreground" aria-hidden />
            )}
            {railLabel(payout.rail)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Scheduled {formatWhen(payout.scheduledAtIso)}
            {payout.paidAtIso ? ` · Paid ${formatWhen(payout.paidAtIso)}` : ""}
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-border bg-muted/20 p-4 text-sm text-muted-foreground dark:border-border/80">
        <p>
          <span className="font-medium text-foreground">How this list works (demo):</span> we show{" "}
          <span className="font-medium text-foreground">completed</span> tenant payments from your ledger whose timestamps fall
          in the same calendar month (UTC) as this payout&apos;s schedule. The sum of those payments (
          <span className="tabular-nums font-medium text-foreground">{paymentsTotal.toLocaleString("en-KE")} KES</span>) is shown
          for reconciliation; the batch gross may differ slightly from mock data generation.
          {Math.abs(variance) > 0 && (
            <span className="block pt-2">
              Difference vs batch gross:{" "}
              <span className="font-mono tabular-nums text-foreground">{variance.toLocaleString("en-KE")} KES</span>
            </span>
          )}
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-[#0A4266] dark:text-[#6BB4E8]" aria-hidden />
          <h2 className="text-lg font-semibold text-foreground">Payments in this period</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Tenant</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {attributed.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      No completed payments found in this month for your portfolio. Try another payout or expand demo data.
                    </td>
                  </tr>
                ) : (
                  attributed.map((row) => (
                    <tr key={row.id} className="bg-card hover:bg-muted/40">
                      <td className="max-w-[200px] px-4 py-3 font-mono text-xs text-foreground">{row.reference}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">{row.tenantName}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="size-3 shrink-0" aria-hidden />
                          {row.property}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">{categoryLabel(row.category)}</td>
                      <td className="px-4 py-3 text-foreground">{methodLabel(row.method)}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-foreground">
                        {row.amountKes.toLocaleString("en-KE")} KES
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatWhen(row.createdAtIso)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/landlords/dashboard/tenants/${encodeURIComponent(row.tenantId)}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "inline-flex h-8 rounded-full px-3 text-xs"
                          )}
                        >
                          View tenant
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {attributed.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-sm dark:border-border/80">
              <span className="text-muted-foreground">
                {attributed.length} payment{attributed.length === 1 ? "" : "s"} · Subtotal{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {paymentsTotal.toLocaleString("en-KE")} KES
                </span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3.5" aria-hidden />
                Month aligned with payout schedule (UTC)
              </span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
