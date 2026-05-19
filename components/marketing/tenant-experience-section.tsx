"use client";

import { CheckCircle2 } from "lucide-react";
import Image from "next/image";

import { MobileMockup } from "@/components/marketing/mobile-mockup";
import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";
import { TENANT_LIFESTYLE_IMAGE } from "@/lib/marketing-images";

const BENEFITS = [
  {
    title: "Pay rent on M-Pesa",
    description:
      "Tap once. Get a digital receipt. Co-tenants split rent without screenshots.",
  },
  {
    title: "Buy water in seconds",
    description:
      "STK push, token vended, meter unlocks. No more dry taps at midnight.",
  },
  {
    title: "Top up WiFi",
    description:
      "Buy a daily, weekly, or monthly plan — bandwidth provisions automatically.",
  },
  {
    title: "Report maintenance",
    description:
      "Photo, location, category. Watch the ticket move from open to resolved.",
  },
] as const;

export function TenantExperienceSection() {
  return (
    <section
      id="residents"
      className="relative py-24 sm:py-28 lg:pt-32 lg:pb-40"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
          {/* Mockups + lifestyle photo */}
          <div className="relative order-2 lg:order-1 lg:col-span-7">
            <div className="relative">
              {/* Lifestyle photo behind the mockups */}
              <FadeUp delay={0.05}>
                <div className="relative mx-auto aspect-[5/4] w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-muted shadow-[0_30px_80px_-20px_rgba(10,66,102,0.25)] sm:aspect-[16/10]">
                  <Image
                    src={TENANT_LIFESTYLE_IMAGE.src}
                    alt={TENANT_LIFESTYLE_IMAGE.alt}
                    fill
                    sizes="(max-width: 1024px) 92vw, 56vw"
                    className="object-cover"
                  />
                  {/* Soft scrim for legibility of overlaid mockup */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-[#062538]/65 via-[#062538]/15 to-transparent"
                    aria-hidden
                  />
                  {/* Top corner caption */}
                  <div className="pointer-events-none absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.08] px-3 py-1 text-[11px] font-medium text-white backdrop-blur">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    Live · Karen Springs, House 14B
                  </div>
                </div>
              </FadeUp>

              {/* Phone mockup overlaid bottom-right */}
              <FadeUp
                delay={0.18}
                className="pointer-events-none absolute -bottom-12 right-2 z-10 hidden w-52 sm:block sm:w-60 lg:right-6 lg:w-64"
              >
                <MobileMockup variant="tokens" />
              </FadeUp>

              {/* Mobile-only mockup row */}
              <div className="mt-6 grid grid-cols-2 gap-4 sm:hidden">
                <FadeUp delay={0.18}>
                  <MobileMockup variant="tokens" />
                </FadeUp>
                <FadeUp delay={0.24}>
                  <MobileMockup variant="rent" />
                </FadeUp>
              </div>
            </div>

            {/* Background gradient blob */}
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto h-72 w-3/4 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(107,180,232,0.22),transparent)] blur-3xl dark:bg-[radial-gradient(closest-side,rgba(107,180,232,0.18),transparent)]"
              aria-hidden
            />
          </div>

          {/* Copy */}
          <div className="order-1 lg:order-2 lg:col-span-5">
            <FadeUp>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
                Tenant experience
              </p>
            </FadeUp>
            <FadeUp delay={0.06}>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                The app residents actually want to use.
              </h2>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
                Smart Plumbing ships an installable progressive web app. No
                Play Store hurdles, no 80 MB downloads. Tenants get rent,
                water, WiFi, and maintenance in one place — branded for your
                estate.
              </p>
            </FadeUp>

            <StaggerGroup
              stagger={0.06}
              as="ul"
              className="mt-8 space-y-4"
            >
              {BENEFITS.map((b) => (
                <FadeChild as="li" key={b.title} className="flex gap-3">
                  <span className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                    <CheckCircle2 className="size-3.5" aria-hidden />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      {b.title}
                    </div>
                    <div className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                      {b.description}
                    </div>
                  </div>
                </FadeChild>
              ))}
            </StaggerGroup>

            <FadeUp delay={0.2} className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Works offline · installs in 3 seconds
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
