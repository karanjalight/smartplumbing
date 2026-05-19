"use client";

import {
  ActivitySquare,
  CheckCircle2,
  Gauge,
  Radio,
  Receipt,
  Zap,
} from "lucide-react";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";

const FEATURES = [
  {
    icon: Gauge,
    title: "Prepaid & postpaid",
    description:
      "Run one block prepaid and another postpaid — switch a tenant in one click without losing history.",
  },
  {
    icon: Radio,
    title: "LONGi & STS native",
    description:
      "Onboard STS-compliant LONGi meters directly. Tokens are vended through certified channels.",
  },
  {
    icon: Zap,
    title: "Automated vending",
    description:
      "M-Pesa pays. The platform vends. The tenant’s meter unlocks. All under 4 seconds.",
  },
  {
    icon: ActivitySquare,
    title: "Real-time monitoring",
    description:
      "Leak detection, abnormal usage alerts, and tamper events stream straight to operators.",
  },
] as const;

export function SmartMeteringSection() {
  return (
    <section
      id="metering"
      className="relative overflow-hidden bg-[#0A4266] py-24 text-white sm:py-28 lg:py-32 dark:bg-[#06283f]"
    >
      {/* Decorative grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden
      >
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="meter-grid"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path d="M48 0H0V48" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#meter-grid)" />
        </svg>
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <FadeUp>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7AB8D9]">
                Smart water metering
              </p>
            </FadeUp>
            <FadeUp delay={0.06}>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl">
                Bill by the litre.{" "}
                <span className="text-[#7AB8D9]">Trust the data.</span>
              </h2>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mt-5 text-pretty text-base text-white/75 sm:text-lg">
                Every meter on Smart Plumbing is connected. Tenants buy water
                via M-Pesa and credits land instantly. Landlords get a single
                statement at the end of the month — and no more disputes.
              </p>
            </FadeUp>

            <StaggerGroup
              stagger={0.06}
              className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              {FEATURES.map(({ icon: Icon, title, description }) => (
                <FadeChild
                  key={title}
                  className="group rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-white/[0.07]"
                >
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-[#6BB4E8]/15 text-[#7AB8D9]">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                  </div>
                  <p className="mt-2.5 text-xs leading-relaxed text-white/70">
                    {description}
                  </p>
                </FadeChild>
              ))}
            </StaggerGroup>

            <FadeUp delay={0.18} className="mt-8 flex flex-wrap items-center gap-3 text-xs text-white/70">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-[#7AB8D9]" aria-hidden />
                STS DLMS-compliant
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-[#7AB8D9]" aria-hidden />
                Tamper-event logging
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-[#7AB8D9]" aria-hidden />
                Per-unit reconciliation
              </span>
            </FadeUp>
          </div>

          {/* Vending visual */}
          <FadeUp delay={0.1}>
            <VendingFlow />
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

function VendingFlow() {
  return (
    <div className="relative" aria-hidden>
      <div className="absolute -inset-10 -z-10 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(107,180,232,0.25),transparent)] blur-3xl" />

      <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] backdrop-blur sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-white/60">
              Vending pipeline
            </div>
            <div className="mt-0.5 text-base font-semibold text-white">
              House 14B · Karen Springs
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            3.8s · success
          </span>
        </div>

        <ol className="mt-6 space-y-3">
          {[
            {
              t: "Tenant requests",
              s: "KSh 300 · M-Pesa STK push",
              ok: true,
            },
            {
              t: "Daraja confirms",
              s: "TX ID · TKJ8XF7A2P",
              ok: true,
            },
            {
              t: "Token vended",
              s: "1,200 L · STS 20-digit",
              ok: true,
            },
            {
              t: "Meter unlocked",
              s: "Live · acknowledged",
              ok: true,
            },
          ].map((step, i) => (
            <li
              key={step.t}
              className="relative flex items-start gap-4 rounded-2xl border border-white/5 bg-white/[0.03] p-4"
            >
              <div className="relative">
                <span className="grid size-8 place-items-center rounded-full border border-white/15 bg-white/10 text-[11px] font-semibold text-white">
                  {i + 1}
                </span>
                {i < 3 && (
                  <span className="absolute left-1/2 top-full block h-3 w-px -translate-x-1/2 bg-white/15" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">
                    {step.t}
                  </span>
                  <CheckCircle2 className="size-4 text-emerald-400" aria-hidden />
                </div>
                <div className="mt-0.5 text-[11px] text-white/60">{step.s}</div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-[#6BB4E8]/30 bg-[#6BB4E8]/10 p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[#6BB4E8]/20 text-[#7AB8D9]">
              <Receipt className="size-4" aria-hidden />
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#7AB8D9]">
                Auto-receipt
              </div>
              <div className="text-sm font-semibold text-white">
                Sent via SMS · WhatsApp
              </div>
            </div>
          </div>
          <span className="text-sm font-semibold text-white">KSh 300</span>
        </div>
      </div>
    </div>
  );
}
