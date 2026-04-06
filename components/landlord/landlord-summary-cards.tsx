import { Building2, Gauge, TrendingUp, Users, Wallet } from "lucide-react";
import Link from "next/link";

const cards = [
  {
    title: "Buildings",
    value: "4",
    subtext: "12 units across 4 sites",
    subtextPositive: true,
    icon: Building2,
    trendIcon: TrendingUp,
    href: "/landlords/dashboard/buildings",
    actionLabel: "View buildings",
    bgClass: "bg-violet-50 dark:bg-violet-950/30",
    iconBgClass: "bg-violet-200/60 dark:bg-violet-800/40",
  },
  {
    title: "Smart meters",
    value: "12",
    subtext: "11 online, 1 reconnecting",
    subtextPositive: true,
    icon: Gauge,
    trendIcon: TrendingUp,
    href: "/landlords/dashboard/meters",
    actionLabel: "Manage meters",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    iconBgClass: "bg-amber-200/60 dark:bg-amber-800/40",
  },
  {
    title: "Collected this month",
    value: "KES 284k",
    subtext: "+8% vs last month",
    subtextPositive: true,
    icon: Wallet,
    trendIcon: TrendingUp,
    href: "/landlords/dashboard/finance/payments",
    actionLabel: "Payments & billing",
    bgClass: "bg-rose-50 dark:bg-rose-950/30",
    iconBgClass: "bg-rose-200/60 dark:bg-rose-800/40",
  },
  {
    title: "Tenants",
    value: "12",
    subtext: "10 active, 2 on notice",
    subtextPositive: true,
    icon: Users,
    trendIcon: TrendingUp,
    href: "/landlords/dashboard/tenants",
    actionLabel: "Manage tenants",
    bgClass: "bg-sky-50 dark:bg-sky-950/30",
    iconBgClass: "bg-sky-200/60 dark:bg-sky-800/40",
  },
];

export function LandlordSummaryCards() {
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
              <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
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
