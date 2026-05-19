"use client";

import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CreditCard,
  Droplets,
  Smartphone,
  Wifi,
  Wrench,
} from "lucide-react";
import * as React from "react";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";
import { cn } from "@/lib/utils";

type ModuleCard = {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  highlight?: boolean;
  span?: string;
};

const MODULES: ModuleCard[] = [
  {
    icon: Droplets,
    title: "Smart Metering",
    description:
      "STS prepaid and postpaid water — vended in seconds via M-Pesa, audited per drop.",
    highlight: true,
    span: "lg:col-span-2",
  },
  {
    icon: Building2,
    title: "Property Management",
    description:
      "Buildings, units, tenants, and leases unified in one operational source of truth.",
  },
  {
    icon: Smartphone,
    title: "Tenant App",
    description:
      "An installable PWA where residents pay rent, buy water, and report issues.",
  },
  {
    icon: Wrench,
    title: "Maintenance",
    description:
      "Tickets, dispatches, SLAs, and vendor invoices — without leaving the platform.",
  },
  {
    icon: CreditCard,
    title: "Payments & Payouts",
    description:
      "M-Pesa Daraja, Paystack, and scheduled landlord payouts with full audit trail.",
  },
  {
    icon: Wifi,
    title: "WiFi Billing",
    description:
      "Sell internet packages per unit, captive-portal ready, reconciles automatically.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description:
      "Live cash flow, vending volumes, occupancy, and per-building P&L.",
  },
];

export function ModulesSection() {
  return (
    <section
      id="platform"
      className="relative py-24 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              One platform · seven workflows
            </p>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Every operation your property runs on.
            </h2>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              From the moment a tenant moves in to the day a landlord cashes
              out, Smart Plumbing replaces every spreadsheet, group chat, and
              walk-in collection.
            </p>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.06}
          className="mt-16 grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {MODULES.map(({ icon: Icon, title, description, highlight, span }) => (
            <FadeChild key={title} className={cn("group", span)}>
              <article
                className={cn(
                  "relative flex h-full flex-col overflow-hidden rounded-3xl border p-7 transition-all duration-300",
                  highlight
                    ? "border-transparent bg-gradient-to-br from-[#0A4266] to-[#0d3854] text-white shadow-[0_25px_60px_-25px_rgba(10,66,102,0.55)] hover:from-[#0c4870] hover:to-[#0e3a58]"
                    : "border-border bg-background hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_25px_60px_-25px_rgba(10,66,102,0.18)] dark:hover:border-foreground/30"
                )}
              >
                {highlight && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-40"
                    aria-hidden
                  >
                    <div className="absolute -right-12 -top-12 size-48 rounded-full bg-[#6BB4E8]/30 blur-3xl" />
                    <div className="absolute -bottom-16 -left-16 size-48 rounded-full bg-white/10 blur-3xl" />
                  </div>
                )}

                <div className="relative flex items-center justify-between">
                  <span
                    className={cn(
                      "grid size-11 place-items-center rounded-2xl",
                      highlight
                        ? "bg-white/15 text-white"
                        : "bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]"
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className={cn(
                      "size-5 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5",
                      highlight ? "text-white/70" : "text-muted-foreground/60"
                    )}
                    aria-hidden
                  />
                </div>

                <h3
                  className={cn(
                    "relative mt-6 text-xl font-semibold tracking-tight",
                    highlight ? "text-white" : "text-foreground"
                  )}
                >
                  {title}
                </h3>
                <p
                  className={cn(
                    "relative mt-2 max-w-md text-sm leading-relaxed",
                    highlight ? "text-white/75" : "text-muted-foreground"
                  )}
                >
                  {description}
                </p>

                {highlight && (
                  <div className="relative mt-6 grid grid-cols-3 gap-3">
                    <FeatureChip label="STS tokens" />
                    <FeatureChip label="LONGi" />
                    <FeatureChip label="Leak alerts" />
                  </div>
                )}
              </article>
            </FadeChild>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

function FeatureChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white/85 backdrop-blur">
      {label}
    </span>
  );
}
