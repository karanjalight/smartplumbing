"use client";

import {
  Database,
  KeyRound,
  Layers3,
  Lock,
  ScrollText,
  ShieldCheck,
} from "lucide-react";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";

const PILLARS = [
  {
    icon: Lock,
    title: "End-to-end RLS",
    description:
      "Every row in Supabase is gated by role-based RLS. Landlords never see another landlord's tenants — at the database level, not just the UI.",
  },
  {
    icon: ShieldCheck,
    title: "SOC-2 ready architecture",
    description:
      "Audit logs on every privileged action, encrypted at rest, encrypted in transit, with least-privilege service accounts.",
  },
  {
    icon: KeyRound,
    title: "M-Pesa Daraja certified flows",
    description:
      "Push, B2C, and STK flows are signed and idempotent. Webhooks verify Safaricom callbacks before any ledger entry.",
  },
  {
    icon: ScrollText,
    title: "STS DLMS compliant",
    description:
      "Tokens are vended via certified STS channels with full per-meter logs. Tamper events fire alerts to operators in real time.",
  },
  {
    icon: Database,
    title: "Backed up daily",
    description:
      "Point-in-time recovery and off-region snapshots. Your portfolio survives a regional outage without you noticing.",
  },
  {
    icon: Layers3,
    title: "Tested on Kenyan networks",
    description:
      "Optimized for spotty mobile data and intermittent ISP service. The tenant app installs as a PWA and works offline.",
  },
] as const;

export function TrustPillarsSection() {
  return (
    <section className="relative border-y border-border/70 bg-muted/30 py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              Security & reliability
            </p>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Built like utility infrastructure.{" "}
              <span className="text-muted-foreground">
                Because that&apos;s what it is.
              </span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              We carry rent money and water credit on behalf of thousands of
              Kenyan households. The platform is built to that standard — and
              audited against it every month.
            </p>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.06}
          className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
        >
          {PILLARS.map(({ icon: Icon, title, description }) => (
            <FadeChild
              key={title}
              className="group rounded-3xl border border-border bg-background p-7 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_25px_60px_-25px_rgba(10,66,102,0.18)]"
            >
              <span className="grid size-11 place-items-center rounded-2xl bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </FadeChild>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
