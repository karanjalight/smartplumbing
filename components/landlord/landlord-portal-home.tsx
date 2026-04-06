"use client";

import { Building2, CreditCard, Gauge, Layers, Users } from "lucide-react";
import Link from "next/link";

import { LandlordAlertsPreview } from "@/components/landlord/landlord-alerts-preview";
import { LandlordRevenueLineChart } from "@/components/landlord/landlord-revenue-line-chart";
import { LandlordSummaryCards } from "@/components/landlord/landlord-summary-cards";
import { cn } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    href: "/landlords/dashboard/tenants",
    label: "Tenants",
    hint: "Units & contacts",
    icon: Users,
  },
  {
    href: "/landlords/dashboard/buildings",
    label: "Buildings",
    hint: "Sites & units",
    icon: Layers,
  },
  {
    href: "/landlords/dashboard/finance/payments",
    label: "Payments",
    hint: "M-Pesa & balances",
    icon: CreditCard,
  },
  {
    href: "/landlords/dashboard/meters",
    label: "Meters",
    hint: "Devices & status",
    icon: Gauge,
  },
] as const;

export function LandlordPortalHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Landlord dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Your portfolio at a glance: occupancy, meter health, collections, and
          anything that needs attention — without admin-only operations tools.
        </p>
      </div>

      <div className="space-y-4">
        <LandlordSummaryCards />
        
      </div>


      <section aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Quick actions
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {QUICK_ACTIONS.map(({ href, label, hint, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-4 text-center shadow-sm transition-colors",
                "hover:border-[#0A4266]/40 hover:bg-muted/40 dark:hover:border-[#6BB4E8]/35",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A4266] focus-visible:ring-offset-2 dark:focus-visible:ring-[#6BB4E8]"
              )}
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">{hint}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <LandlordRevenueLineChart />
        </div>
        <div className="min-w-0 lg:col-span-1">
          <LandlordAlertsPreview />
        </div>
      </div>


      <div className="flex hidden items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 dark:bg-muted/20">
        <Building2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Operations dashboard</p>
          <p className="mt-1">
            Need admin tools (meter onboarding, manual tokens, full landlord
            directory)?{" "}
            <Link
              href="/dashboard"
              className="font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
            >
              Open the main dashboard
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
