"use client";

import {
  AlertTriangle,
  Calculator,
  Clock4,
  Layers,
  MessageSquareWarning,
} from "lucide-react";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";

const PAIN_POINTS = [
  {
    icon: Calculator,
    title: "Manual billing wastes hours",
    description:
      "Caretakers chase readings, agents reconcile M-Pesa screenshots, and tenants dispute every invoice.",
  },
  {
    icon: MessageSquareWarning,
    title: "Endless utility disputes",
    description:
      "Without trusted meter data, every water bill becomes an argument that drags into next month.",
  },
  {
    icon: Clock4,
    title: "Maintenance falls through cracks",
    description:
      "Tickets live in WhatsApp groups, callouts go missing, and small leaks become expensive repairs.",
  },
  {
    icon: Layers,
    title: "Disconnected tools",
    description:
      "Property logs in Excel, payments on a phone, WiFi on a separate router — nothing talks to anything.",
  },
] as const;

export function ProblemSection() {
  return (
    <section className="relative border-y border-border/70 bg-muted/30 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              The reality of running property in Kenya
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Your portfolio is growing.{" "}
              <span className="text-muted-foreground">
                Your tooling hasn&apos;t.
              </span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              Most agencies and landlords still operate on a stack glued
              together with M-Pesa SMS, paper meters, and goodwill. It costs
              you money every month — and it doesn&apos;t scale.
            </p>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.07}
          className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {PAIN_POINTS.map(({ icon: Icon, title, description }) => (
            <FadeChild
              key={title}
              className="group relative flex flex-col gap-3 rounded-2xl border border-border bg-background p-6 transition-all hover:-translate-y-0.5 hover:border-[#0A4266]/40 hover:shadow-[0_15px_40px_-15px_rgba(10,66,102,0.25)] dark:hover:border-[#6BB4E8]/50"
            >
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <Icon className="size-5" aria-hidden />
                </span>
                <AlertTriangle
                  className="size-4 text-muted-foreground/60 transition-colors group-hover:text-destructive"
                  aria-hidden
                />
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </FadeChild>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
