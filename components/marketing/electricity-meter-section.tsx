"use client";

import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";
import { ELECTRICITY_METER_IMAGE } from "@/lib/marketing-images";

const POINTS = [
  {
    title: "STS prepaid & keypad-ready",
    description:
      "Certified STS/IEC prepaid meters with an on-unit keypad — a tenant keys in a 20-digit token and power restores instantly.",
  },
  {
    title: "Top up on M-Pesa",
    description:
      "Tenants buy electricity units from the app or by STK push, the same way they pay rent and buy water on Mali Smart.",
  },
  {
    title: "Common-area recovery",
    description:
      "Meter shared lighting, pumps, lifts, and security power, then split the cost fairly across units by landlord rules.",
  },
  {
    title: "Tamper & outage alerts",
    description:
      "Reverse-energy, cover-open, and low-balance events stream straight to operators in real time.",
  },
] as const;

export function ElectricityMeterSection() {
  return (
    <section
      id="electricity-meter"
      className="relative overflow-hidden bg-muted/30 py-24 sm:py-28 lg:py-32"
    >
      {/* soft brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-[#0A4266]/[0.05] to-transparent dark:from-[#6BB4E8]/[0.05]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Meter product shot */}
          <FadeUp>
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[2.5rem] bg-[radial-gradient(closest-side,rgba(107,180,232,0.22),transparent)] blur-3xl dark:bg-[radial-gradient(closest-side,rgba(107,180,232,0.18),transparent)]"
              />
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-white shadow-[0_30px_80px_-20px_rgba(10,66,102,0.25)]">
                <Image
                  src={ELECTRICITY_METER_IMAGE.src}
                  alt={ELECTRICITY_METER_IMAGE.alt}
                  fill
                  sizes="(max-width: 1024px) 92vw, 46vw"
                  className="object-contain p-6"
                />
                <div className="pointer-events-none absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-medium text-foreground backdrop-blur">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  STS · IEC-compliant prepaid meter
                </div>
              </div>
            </div>
          </FadeUp>

          {/* Copy */}
          <div>
            <FadeUp>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
                Prepaid electricity
              </p>
            </FadeUp>
            <FadeUp delay={0.06}>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Prepaid power meters, tenant-ready.
              </h2>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
                Give every unit a keypad prepaid electricity meter and let tenants
                buy units on M-Pesa — one app for rent, water, and power, with a
                single ledger for owners.
              </p>
            </FadeUp>

            <StaggerGroup stagger={0.06} as="ul" className="mt-8 space-y-4">
              {POINTS.map((point) => (
                <FadeChild as="li" key={point.title} className="flex gap-3">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {point.title}
                    </div>
                    <div className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {point.description}
                    </div>
                  </div>
                </FadeChild>
              ))}
            </StaggerGroup>
          </div>
        </div>
      </div>
    </section>
  );
}
