"use client";

import {
  Building2,
  Layers,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Zap,
} from "lucide-react";
import * as React from "react";

import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";

type Step = {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
};

const STEPS: Step[] = [
  {
    icon: Building2,
    title: "Onboard your portfolio",
    description:
      "Add buildings, units, tenants, and leases in minutes — or import a spreadsheet. Assign STS water meters and set rent in one pass.",
  },
  {
    icon: Zap,
    title: "Automate rent, water & WiFi",
    description:
      "Tenants pay rent and buy prepaid water on M-Pesa from the app. Invoices, receipts, reminders, and leak alerts run on their own.",
  },
  {
    icon: Wallet,
    title: "Get paid and stay in control",
    description:
      "Every shilling reconciles to a live ledger and scheduled payouts hit landlords' M-Pesa. Watch cash flow, arrears, and occupancy at a glance.",
  },
];

type Outcome = {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
};

const OUTCOMES: Outcome[] = [
  {
    icon: TrendingUp,
    title: "Get paid faster",
    description:
      "Automated M-Pesa collection and reminders end the monthly chase — rent lands days sooner.",
  },
  {
    icon: ShieldCheck,
    title: "Stop revenue leaks",
    description:
      "Prepaid STS metering replaces estimated bills and quietly lost water with billing you can audit per litre.",
  },
  {
    icon: Layers,
    title: "One source of truth",
    description:
      "Buildings, tenants, leases, payments, and maintenance live in one place — no spreadsheets, no WhatsApp reconciliations.",
  },
];

const LOGOS = [
  "Karen Properties",
  "Tatu Estates",
  "Riverside Mews",
  "Westpark Holdings",
  "Ngong Heights",
  "Lavington Co.",
];

export function HowItWorksSection() {
  return (
    <>
    <section
      id="how-it-works"
      className="relative overflow-hidden border-y border-border/60 bg-muted/30 py-24 sm:py-28 lg:py-32"
    >
      {/* soft brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-[#0A4266]/[0.05] to-transparent dark:from-[#6BB4E8]/[0.05]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold tracking-[0.18em] text-[#0A4266] uppercase dark:text-[#7AB8D9]">
              How it works
            </p>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              From onboarding to payout — live in a week.
            </h2>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              No migration project and no IT team. Bring your buildings on, switch
              on automation, and let rent and water settle to M-Pesa on their own.
            </p>
          </FadeUp>
        </div>

        {/* Steps */}
        <div className="relative mt-16">
          {/* connecting line (desktop) */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-[#0A4266]/25 to-transparent lg:block dark:via-[#6BB4E8]/25"
          />
          <StaggerGroup
            stagger={0.08}
            className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-10"
          >
            {STEPS.map(({ icon: Icon, title, description }, i) => (
              <FadeChild key={title} className="relative text-center">
                <div className="flex items-center justify-center gap-3">
                  <span className="relative grid size-14 shrink-0 place-items-center rounded-2xl bg-[#0A4266] text-white shadow-[0_16px_36px_-14px_rgba(10,66,102,0.6)] dark:bg-[#6BB4E8] dark:text-[#062538]">
                    <Icon className="size-6" aria-hidden />
                    <span className="absolute -right-2 -top-2 grid size-6 place-items-center rounded-full border border-border bg-background text-xs font-bold text-[#0A4266] dark:text-[#7AB8D9]">
                      {i + 1}
                    </span>
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </FadeChild>
            ))}
          </StaggerGroup>
        </div>

        {/* Outcomes / benefits */}
        <FadeUp delay={0.1} className="mt-16">
          <div className="rounded-3xl border border-border bg-background p-6 shadow-sm sm:p-8 dark:border-border/80">
            <p className="text-center text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
              What you get out of it
            </p>
            <StaggerGroup
              stagger={0.06}
              className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3"
            >
              {OUTCOMES.map(({ icon: Icon, title, description }) => (
                <FadeChild key={title} className="flex gap-3.5">
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                </FadeChild>
              ))}
            </StaggerGroup>
          </div>
        </FadeUp>
      </div>
    </section>

      <section id="product" className="relative bg-background mt-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative mx-auto -mt-16 max-w-6xl sm:-mt-24">
            <div
              className="pointer-events-none absolute inset-x-8 -top-6 -z-10 h-72 rounded-full bg-[radial-gradient(closest-side,rgba(107,180,232,0.35),transparent)] blur-3xl dark:bg-[radial-gradient(closest-side,rgba(107,180,232,0.18),transparent)]"
              aria-hidden
            />
            <FadeUp amount={0.1}>
              <DashboardMockup />
            </FadeUp>
          </div>

          <FadeUp delay={0.15} className="mx-auto my-16 max-w-5xl text-center">
            <p className="text-md font-bold tracking-[0.18em] text-muted-foreground uppercase">
              Trusted by property teams across Kenya
            </p>
            <StaggerGroup
              stagger={0.06}
              className="mt-6 grid grid-cols-2 items-center gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6"
            >
              {LOGOS.map((name) => (
                <FadeChild
                  key={name}
                  className="text-sm font-semibold tracking-tight text-muted-foreground/80 transition-colors hover:text-foreground"
                >
                  {name}
                </FadeChild>
              ))}
            </StaggerGroup>
          </FadeUp>
        </div>
      </section>
    </>
  );
}
