import {
  AlertTriangle,
  Gauge,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";

import { formatMomChangeLabel, type DashboardSummary } from "@/lib/dashboard-overview-data";
import { formatKes } from "@/lib/tenants-data";

type SummaryCardsProps = { summary: DashboardSummary };

export function SummaryCards({ summary }: SummaryCardsProps) {
  const revenuePositive = summary.revenue.momChangePct !== null && summary.revenue.momChangePct >= 0;
  const revenueChangeLabel = formatMomChangeLabel(summary.revenue.momChangePct);

  const cards = [
    {
      title: "Total Meters",
      value: summary.meters.total.toLocaleString("en-KE"),
      subtext: `${summary.meters.online} online · ${summary.meters.offline} offline`,
      subtextPositive: false,
      icon: Gauge,
      trendIcon: TrendingUp,
      href: "/dashboard/meters",
      actionLabel: "Manage Meters",
      bgClass: "bg-amber-50 dark:bg-amber-950/30",
      iconBgClass: "bg-amber-200/60 dark:bg-amber-800/40",
    },
    {
      title: "Active Tenants",
      value: summary.tenants.active.toLocaleString("en-KE"),
      subtext: `${summary.tenants.overdue} overdue · ${summary.tenants.lowCredit} low credit`,
      subtextPositive: false,
      icon: Users,
      trendIcon: TrendingUp,
      href: "/dashboard/tenants",
      actionLabel: "View Tenants",
      bgClass: "bg-violet-50 dark:bg-violet-950/30",
      iconBgClass: "bg-violet-200/60 dark:bg-violet-800/40",
    },
    {
      title: "Total Revenue",
      value: formatKes(summary.revenue.allTimeCompletedKes),
      subtext: revenueChangeLabel,
      subtextPositive: revenuePositive,
      icon: Wallet,
      trendIcon: TrendingUp,
      href: "/dashboard/payments",
      actionLabel: "View Payments",
      bgClass: "bg-rose-50 dark:bg-rose-950/30",
      iconBgClass: "bg-rose-200/60 dark:bg-rose-800/40",
    },
    {
      title: "Alerts",
      value: summary.alerts.openAlertsTotal.toLocaleString("en-KE"),
      subtext: `${summary.alerts.metersWithAlerts} meters need attention`,
      subtextPositive: false,
      icon: AlertTriangle,
      trendIcon: AlertTriangle,
      href: "/dashboard/meter-health",
      actionLabel: "Check Meter Health",
      bgClass: "bg-sky-50 dark:bg-sky-950/30",
      iconBgClass: "bg-sky-200/60 dark:bg-sky-800/40",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const TrendIcon = card.trendIcon;
        return (
          <div
            key={card.title}
            className={`flex flex-col overflow-hidden rounded-xl border border-border ${card.bgClass} shadow-sm transition-shadow hover:shadow-md dark:border-border/80`}
          >
            <div className="flex flex-1 flex-col p-5">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${card.iconBgClass} text-foreground`}
                >
                  <Icon className="size-5" aria-hidden />
                </div>
                <TrendIcon
                  className={`size-5 shrink-0 ${card.subtextPositive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}
                  aria-hidden
                />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {card.title}
              </p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                {card.value}
              </p>
              <p
                className={`mt-0.5 text-sm ${card.subtextPositive ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground"}`}
              >
                {card.subtext}
              </p>
            </div>
            <Link
              href={card.href}
              className="block w-full bg-[#0A4266] px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            >
              {card.actionLabel}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
