"use client";

import {
  ArrowRight,
  Banknote,
  Building2,
  ClipboardList,
  Users2,
} from "lucide-react";
import Link from "next/link";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";

const FEATURES = [
  {
    icon: Building2,
    title: "Multi-building portfolios",
    description:
      "Manage Karen, Kilimani, and Kileleshwa from a single dashboard. Every building is its own ledger, every tenant tagged to a unit.",
    points: [
      "Unlimited buildings & units",
      "Role-based staff access",
      "Owner vs. agency views",
    ],
  },
  {
    icon: Banknote,
    title: "Automated landlord payouts",
    description:
      "Configure payout day, fees, and split rules once. The platform settles to landlord M-Pesa or bank — every cycle, every time.",
    points: [
      "Scheduled M-Pesa B2C",
      "Per-landlord statements",
      "Reconciled to the shilling",
    ],
  },
  {
    icon: Users2,
    title: "Tenant lifecycle",
    description:
      "Onboard, lease, bill, renew, and offboard with full audit trail. No more lost deposit ledgers or missing handover sheets.",
    points: [
      "Digital lease handoff",
      "Deposits & arrears tracked",
      "Move-out reconciliations",
    ],
  },
  {
    icon: ClipboardList,
    title: "Operational reporting",
    description:
      "Board-ready PDF reports on demand. P&L per building, vending volumes, ticket SLAs, and arrears aging — at month-end or anytime.",
    points: [
      "Per-building P&L",
      "Arrears aging exports",
      "Vendor performance",
    ],
  },
] as const;

export function AgencySection() {
  return (
    <section
      id="operators"
      className="relative border-y border-border/70 bg-muted/30 py-24 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              For agencies, estates & landlords
            </p>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Run a portfolio.{" "}
              <span className="text-muted-foreground">
                Not a fire department.
              </span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              Property managers running 10 to 10,000 units use Mali Smart
              to collect rent, vend water, dispatch maintenance, and pay
              landlords — without growing the back-office.
            </p>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.07}
          className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2"
        >
          {FEATURES.map(({ icon: Icon, title, description, points }) => (
            <FadeChild
              key={title}
              className="group relative flex flex-col gap-5 rounded-3xl border border-border bg-background p-7 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_25px_60px_-25px_rgba(10,66,102,0.18)] sm:p-8"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-xl font-semibold tracking-tight text-foreground">
                  {title}
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
              <ul className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {points.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-2 text-xs font-medium text-foreground/80"
                  >
                    <span className="size-1.5 rounded-full bg-[#0A4266] dark:bg-[#7AB8D9]" />
                    {p}
                  </li>
                ))}
              </ul>
            </FadeChild>
          ))}
        </StaggerGroup>

        <FadeUp delay={0.12} className="mt-12 text-center">
          <Link
            href="/book-demo"
            className="group inline-flex h-11 items-center justify-center gap-2 rounded-full border border-foreground bg-foreground px-5 text-sm font-semibold text-background transition-all hover:gap-2.5"
          >
            Book a demo for your portfolio
            <ArrowRight
              className="size-4 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </FadeUp>
      </div>
    </section>
  );
}
