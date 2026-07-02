"use client";

import { Activity, ArrowRight, CreditCard, Droplets } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { AlertPreviewItem } from "@/lib/landlord/summary";
import { cn } from "@/lib/utils";

const KIND_STYLES = {
  meter: { Icon: Activity, ring: "ring-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-400" },
  payment: { Icon: CreditCard, ring: "ring-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  leak: { Icon: Droplets, ring: "ring-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400" },
} as const;

export function LandlordAlertsPreview({ alerts }: { alerts: AlertPreviewItem[] }) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80"
      aria-labelledby="landlord-alerts-preview-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="landlord-alerts-preview-heading" className="text-sm font-semibold text-foreground">
            Needs attention
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {alerts.length}
          </span>
        </div>
        <Link
          href="/landlords/dashboard/alerts"
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1 text-[#0A4266] dark:text-[#6BB4E8]")}
        >
          View all
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
      {alerts.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-5">
          All clear — no alerts right now.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {alerts.map((a) => {
            const { Icon, ring } = KIND_STYLES[a.kind];
            return (
              <li key={a.id}>
                <Link
                  href="/landlords/dashboard/alerts"
                  className="flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-5"
                >
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg ring-1", ring)}>
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{a.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{a.detail}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
