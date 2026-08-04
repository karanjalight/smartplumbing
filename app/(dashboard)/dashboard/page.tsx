import { MoreHorizontal, Send } from "lucide-react";
import Link from "next/link";

import { MetricCards } from "@/components/dashboard/metric-cards";
import { PaymentDonut } from "@/components/dashboard/payment-donut";
import { RecentActivityFeed } from "@/components/dashboard/recent-activity-feed";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import {
  buildRecentActivity,
  categoryDisplayLabel,
  countPendingElectricityDeliveries,
  formatMomChangeLabel,
  summarizeCategoryDistribution,
  summarizeDashboard,
  summarizeMonthlyRevenue,
  summarizePaymentMethodMix,
  summarizeTokenSales,
} from "@/lib/dashboard-overview-data";
import { listMeters, listPayments, listTenants, listTokenPurchases } from "@/lib/supabase/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { PaymentCategory } from "@/lib/supabase/types";
import { formatKes } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Dashboard — Mali Smart",
  description: "Overview of earnings, revenue, and customer payments.",
};

async function safeList<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

const CATEGORY_COLORS: Record<PaymentCategory, string> = {
  rent: "#0A4266",
  tokens: "#6BB4E8",
  service: "#EAB308",
  shop: "#EC4899",
  deposit: "#22C55E",
};

export default async function DashboardPage() {
  const supabase = await getSupabaseServerClient();
  const [payments, tokenPurchases, tenants, meters] = await Promise.all([
    safeList(() => listPayments(supabase)),
    safeList(() => listTokenPurchases(supabase)),
    safeList(() => listTenants(supabase)),
    safeList(() => listMeters(supabase)),
  ]);

  const tenantNamesById = new Map(tenants.map((t) => [t.id, t.full_name]));

  const now = new Date();
  const meterModelTypeById = new Map(meters.map((m) => [m.id, m.model_type]));

  const summary = summarizeDashboard(payments, tenants, meters, now);
  const tokenSales = summarizeTokenSales(tokenPurchases, meterModelTypeById, now);
  const pendingDeliveries = countPendingElectricityDeliveries(tokenPurchases, meterModelTypeById);

  const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
  const nextYearStart = new Date(now.getFullYear() + 1, 0, 1).toISOString();
  const methodMix = summarizePaymentMethodMix(payments, yearStart, nextYearStart);
  const monthlyRevenue = summarizeMonthlyRevenue(payments, now.getFullYear(), now);
  const categoryDistribution = summarizeCategoryDistribution(payments, yearStart, nextYearStart);
  const categoryTotalKes = categoryDistribution.reduce((sum, slice) => sum + slice.kes, 0);

  const recentActivity = buildRecentActivity(payments, tokenPurchases, tenantNamesById, 8);

  const revenueChangeLabel = formatMomChangeLabel(summary.revenue.momChangePct);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Dashboard
      </h1>

      <div className="space-y-4">
        <SummaryCards summary={summary} />
        <p className="text-muted-foreground pl-4 ">
          Overview of earnings, revenue, and customer payments.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <MetricCards
              earnings={{
                value: formatKes(summary.revenue.thisMonthCompletedKes),
                change: revenueChangeLabel,
              }}
              tokenSales={{
                value: formatKes(tokenSales.thisMonthKes),
                progress:
                  tokenSales.totalCount === 0
                    ? 0
                    : Math.round((tokenSales.deliveredCount / tokenSales.totalCount) * 100),
                leftLabel: `${tokenSales.deliveredCount} delivered`,
                rightLabel: `${tokenSales.pendingCount} pending`,
              }}
            />
          </div>
          <div className="rounded-xl border border-border bg-card p-5 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <h2 className="text-sm font-medium text-muted-foreground">
              Customer Payment Distribution
            </h2>
            <PaymentDonut data={methodMix} />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-muted-foreground">
                  Token Delivery Queue
                </h2>
                <p className="mt-2 text-sm text-foreground">
                  {pendingDeliveries > 0
                    ? `${pendingDeliveries} electricity token ${pendingDeliveries === 1 ? "delivery is" : "deliveries are"} waiting to be pushed to meters.`
                    : "All issued tokens have been delivered."}
                </p>
              </div>
              <Link
                href="/dashboard/tokens"
                aria-label="View token delivery queue"
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon" }),
                  "size-9 shrink-0 rounded-full border-[#0A4266] bg-[#0A4266] text-white hover:bg-[#083d5c] hover:text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                )}
              >
                <Send className="size-4" aria-hidden />
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <h2 className="text-sm font-medium text-muted-foreground">
              Revenue Collection Distribution
            </h2>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {formatKes(categoryTotalKes)}
            </p>
            {categoryDistribution.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No payments recorded yet this year.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {categoryDistribution.map((slice) => (
                  <div key={slice.category}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{categoryDisplayLabel(slice.category)}</span>
                      <span className="font-medium text-foreground">{formatKes(slice.kes)}</span>
                    </div>
                    <div
                      className="mt-1 h-2 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={slice.pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${categoryDisplayLabel(slice.category)}: ${slice.pct}% of total`}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${slice.pct}%`, backgroundColor: CATEGORY_COLORS[slice.category] }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md dark:border-border/80">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                Revenue Distribution
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-full"
                aria-label="Filter or more options"
              >
                <MoreHorizontal className="size-4 text-muted-foreground" aria-hidden />
              </Button>
            </div>
            <RevenueChart data={monthlyRevenue} />
          </div>
        </div>
      </div>

      <RecentActivityFeed items={recentActivity} now={now} />
    </div>
  );
}
