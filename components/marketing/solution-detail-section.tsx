import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";

type DetailFeature = {
  title: string;
  description: string;
};

type DetailStat = {
  value: string;
  label: string;
};

type DetailCta = {
  label: string;
  href: string;
};

type SolutionDetailSectionProps = {
  eyebrow: string;
  title: string;
  description: string;
  features: readonly DetailFeature[];
  checklist: readonly string[];
  stats?: readonly DetailStat[];
  cta?: DetailCta;
};

export function SolutionDetailSection({
  eyebrow,
  title,
  description,
  features,
  checklist,
  stats = [],
  cta = { label: "Talk to us", href: "/contact" },
}: SolutionDetailSectionProps) {
  return (
    <section className="relative overflow-hidden py-24 sm:py-28 lg:py-32">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(107,180,232,0.12),transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
        <div className="lg:col-span-5">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              {eyebrow}
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {title}
            </h2>
            <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {description}
            </p>
          </FadeUp>

          <FadeUp delay={0.1} className="mt-8">
            <div className="rounded-3xl border border-border bg-background p-6 shadow-[0_25px_80px_-40px_rgba(10,66,102,0.35)]">
              <p className="text-sm font-semibold text-foreground">
                What you get
              </p>
              <ul className="mt-4 space-y-3">
                {checklist.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                    <CheckCircle2
                      className="mt-0.5 size-4 shrink-0 text-[#0A4266] dark:text-[#7AB8D9]"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {stats.length > 0 ? (
                <div className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5">
                  {stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-lg font-semibold text-foreground">
                        {stat.value}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <Link
                href={cta.href}
                className="mt-7 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#0A4266] px-5 text-sm font-semibold text-white transition-all hover:bg-[#083350] hover:gap-2.5 dark:bg-[#6BB4E8] dark:text-[#062538] dark:hover:bg-[#7AB8D9]"
              >
                {cta.label}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.06}
          className="grid gap-4 sm:grid-cols-2 lg:col-span-7"
        >
          {features.map((feature) => (
            <FadeChild
              key={feature.title}
              className="rounded-3xl border border-border bg-background p-7 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_25px_60px_-25px_rgba(10,66,102,0.2)]"
            >
              <div className="grid size-11 place-items-center rounded-2xl bg-[#0A4266]/10 text-sm font-semibold text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                {feature.title.slice(0, 1)}
              </div>
              <h3 className="mt-5 text-base font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </FadeChild>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
