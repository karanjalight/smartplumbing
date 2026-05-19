"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { FadeUp } from "@/components/marketing/motion-primitives";

const POINTS = [
  "30-minute onboarding call",
  "First building live in under 7 days",
  "No setup fees · pay per active unit",
] as const;

export function CtaSection() {
  return (
    <section className="relative py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0A4266] via-[#0a3d5c] to-[#06283f] p-10 text-white sm:rounded-[2.5rem] sm:p-14 lg:p-20">
          {/* decorations */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            aria-hidden
          >
            <div className="absolute -right-20 -top-24 size-72 rounded-full bg-[#6BB4E8]/30 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-[#6BB4E8]/15 blur-3xl" />
          </div>
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            aria-hidden
          >
            <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern
                  id="cta-grid"
                  width="56"
                  height="56"
                  patternUnits="userSpaceOnUse"
                >
                  <path d="M56 0H0V56" fill="none" stroke="white" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#cta-grid)" />
            </svg>
          </div>

          <div className="relative grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
            <div className="lg:col-span-8">
              <FadeUp>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7AB8D9]">
                  Ready when you are
                </p>
              </FadeUp>
              <FadeUp delay={0.06}>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
                  Move your portfolio off spreadsheets.
                  <br className="hidden sm:block" />{" "}
                  <span className="text-[#7AB8D9]">
                    Onto infrastructure.
                  </span>
                </h2>
              </FadeUp>
              <FadeUp delay={0.12}>
                <p className="mt-5 max-w-2xl text-pretty text-base text-white/75 sm:text-lg">
                  Talk to our team about your buildings, meters, and tenants.
                  We&apos;ll show you a tailored Smart Plumbing workspace in
                  30 minutes — and have your first property live within a
                  week.
                </p>
              </FadeUp>

              <FadeUp delay={0.18}>
                <ul className="mt-7 grid gap-3 sm:grid-cols-3">
                  {POINTS.map((p) => (
                    <li
                      key={p}
                      className="flex items-center gap-2 text-sm text-white/85"
                    >
                      <CheckCircle2
                        className="size-4 shrink-0 text-[#7AB8D9]"
                        aria-hidden
                      />
                      {p}
                    </li>
                  ))}
                </ul>
              </FadeUp>

              <FadeUp delay={0.24} className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/book-demo"
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#0A4266] shadow-sm transition-all hover:gap-2.5 hover:bg-[#7AB8D9] hover:text-[#062538]"
                >
                  Book a 30-min demo
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
                <Link
                  href="/auth/login"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.05] px-6 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  Sign in to your workspace
                </Link>
              </FadeUp>
            </div>

            {/* Side panel */}
            <FadeUp delay={0.12} className="lg:col-span-4">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7AB8D9]">
                  What you&apos;ll see
                </div>
                <ol className="mt-4 space-y-3">
                  {[
                    "Your portfolio modeled in the platform",
                    "Live meter vending on a sample unit",
                    "M-Pesa rent flow end-to-end",
                    "Pricing for your unit count",
                  ].map((item, i) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 text-sm text-white/85"
                    >
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
                        {i + 1}
                      </span>
                      {item}
                    </li>
                  ))}
                </ol>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
