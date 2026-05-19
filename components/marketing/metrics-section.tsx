"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import * as React from "react";

import { FadeUp } from "@/components/marketing/motion-primitives";

type Metric = {
  value: number;
  /** Formatter applied to the live counter value. */
  format: (n: number) => string;
  label: string;
  sub: string;
};

const METRICS: Metric[] = [
  {
    value: 99.98,
    format: (n) => `${n.toFixed(2)}%`,
    label: "Platform uptime",
    sub: "Rolling 90-day SLA",
  },
  {
    value: 320,
    format: (n) => `${Math.round(n)}+`,
    label: "Buildings live",
    sub: "Nairobi, Kiambu, Mombasa, Kisumu",
  },
  {
    value: 12400,
    format: (n) => `${Math.round(n).toLocaleString("en-KE")}+`,
    label: "Smart meters",
    sub: "STS prepaid · LONGi certified",
  },
  {
    value: 184,
    format: (n) => `KSh ${Math.round(n)}M`,
    label: "Payments cleared",
    sub: "Year-to-date, M-Pesa + bank",
  },
];

export function MetricsSection() {
  return (
    <section
      id="trust"
      className="relative py-24 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              Infrastructure-grade by design
            </p>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Trusted with the rent.{" "}
              <span className="text-muted-foreground">And the water.</span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              Built on Supabase and the M-Pesa Daraja stack, audited monthly,
              and hardened for African network conditions.
            </p>
          </FadeUp>
        </div>

        <div className="relative mt-16 overflow-hidden rounded-3xl border border-border bg-background">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.07]"
            aria-hidden
          >
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="metrics-grid"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M40 0H0V40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                  />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#metrics-grid)" />
            </svg>
          </div>

          <div className="relative grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x lg:grid-cols-4 lg:divide-y-0">
            {METRICS.map((m) => (
              <MetricCell key={m.label} metric={m} />
            ))}
          </div>
        </div>

        <FadeUp delay={0.1} className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs font-medium text-muted-foreground">
          <span>SOC-2 ready architecture</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>End-to-end RLS</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>M-Pesa Daraja certified flows</span>
          <span className="size-1 rounded-full bg-muted-foreground/40" />
          <span>STS DLMS compliant</span>
        </FadeUp>
      </div>
    </section>
  );
}

function MetricCell({ metric }: { metric: Metric }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const prefersReduced = useReducedMotion();
  const [display, setDisplay] = React.useState(prefersReduced ? metric.value : 0);

  React.useEffect(() => {
    if (!inView) return;
    if (prefersReduced) {
      setDisplay(metric.value);
      return;
    }

    const start = performance.now();
    const duration = 1200;
    let raf = 0;

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(metric.value * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, metric.value, prefersReduced]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="px-6 py-10 sm:px-8 sm:py-12 lg:px-10"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {metric.label}
      </div>
      <div className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {metric.format(display)}
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{metric.sub}</div>
    </motion.div>
  );
}
