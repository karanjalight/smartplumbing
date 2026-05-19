"use client";

import { CheckCircle2, Clock, Star, Video } from "lucide-react";
import Image from "next/image";

import { BookDemoForm } from "@/components/marketing/book-demo-form";
import { FadeUp } from "@/components/marketing/motion-primitives";
import { DEMO_BOOKING_IMAGE } from "@/lib/marketing-images";

const AGENDA = [
  "Your portfolio modeled in the platform",
  "Live STS water vending on a sample unit",
  "M-Pesa rent collection end-to-end",
  "Pricing tailored to your unit count",
] as const;

const STATS = [
  { label: "Avg. response", value: "< 1 day" },
  { label: "Demo length", value: "30 min" },
  { label: "Teams onboarded", value: "240+" },
] as const;

export function BookDemoSection() {
  return (
    <section className="relative overflow-hidden">
      <PageBackdrop />

      <DemoGrid />
    </section>
  );
}

function PageBackdrop() {
  return (
    <div
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(107,180,232,0.08),transparent_50%)]"
      aria-hidden
    />
  );
}

function DemoGrid() {
  return (
    <div className="relative mx-auto grid max-w-7xl lg:min-h-[calc(100vh-5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <DemoStoryPanel />
      <DemoFormColumn />
    </div>
  );
}

function DemoStoryPanel() {
  return (
    <aside className="relative flex flex-col justify-between border-b border-border/60 bg-gradient-to-br from-[#062538] via-[#0A4266] to-[#083350] px-6 py-12 text-white sm:px-10 lg:border-b-0 lg:border-r lg:px-12 lg:py-16 xl:px-14">
      <PanelDecorations />

      <div className="relative z-10">
        <FadeUp>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7AB8D9]">
            Smart Plumbing · Kenya
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            See your buildings running on one platform.
          </h2>
          <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-white/75 sm:text-base">
            A focused walkthrough with our onboarding team — no generic slides.
            We configure the demo around your meters, rent cycle, and tenant mix.
          </p>
        </FadeUp>

        <FadeUp delay={0.08} className="mt-8">
          <div className="relative aspect-[4/3] max-w-md overflow-hidden rounded-2xl border border-white/15 shadow-2xl">
            <Image
              src={DEMO_BOOKING_IMAGE.src}
              alt={DEMO_BOOKING_IMAGE.alt}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover object-center"
              priority
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-[#062538]/80 via-transparent to-transparent"
              aria-hidden
            />
            <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 backdrop-blur-md">
              <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#6BB4E8]/20 text-[#7AB8D9]">
                <Video className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 text-left text-xs">
                <p className="font-semibold text-white">Live screen share</p>
                <p className="truncate text-white/70">Google Meet · Zoom · Teams</p>
              </div>
            </div>
          </div>
        </FadeUp>

        <FadeUp delay={0.14} className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7AB8D9]">
            On the agenda
          </p>
          <ol className="mt-3 space-y-2.5">
            {AGENDA.map((item, i) => (
              <li
                key={item}
                className="flex items-start gap-3 text-sm text-white/85"
              >
                <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold">
                  {i + 1}
                </span>
                {item}
              </li>
            ))}
          </ol>
        </FadeUp>
      </div>

      <FadeUp delay={0.2} className="relative z-10 mt-10 lg:mt-12">
        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-8">
          {STATS.map((stat) => (
            <StatCell key={stat.label} stat={stat} />
          ))}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur">
          <div className="flex gap-0.5 text-[#F5A524]" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="size-3.5 fill-current" />
            ))}
          </div>
          <p className="text-sm leading-relaxed text-white/80">
            &ldquo;We retired four spreadsheets in the first week. Rent settles
            to M-Pesa by 10am every payout day.&rdquo;
            <span className="mt-1 block text-xs text-white/55">
              — Wanjiru M., Karen Properties
            </span>
          </p>
        </div>

        <ul className="mt-5 flex flex-wrap gap-4 text-xs text-white/65">
          <li className="flex items-center gap-1.5">
            <Clock className="size-3.5 text-[#7AB8D9]" aria-hidden />
            Tue–Thu · 9am–4pm EAT
          </li>
          <li className="flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5 text-[#7AB8D9]" aria-hidden />
            No setup fees
          </li>
        </ul>
      </FadeUp>
    </aside>
  );
}

function StatCell({ stat }: { stat: (typeof STATS)[number] }) {
  return (
    <div>
      <p className="text-lg font-semibold text-white sm:text-xl">{stat.value}</p>
      <p className="mt-0.5 text-[11px] text-white/60 sm:text-xs">{stat.label}</p>
    </div>
  );
}

function PanelDecorations() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        aria-hidden
      >
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="demo-panel-grid"
              width="56"
              height="56"
              patternUnits="userSpaceOnUse"
            >
              <path d="M56 0H0V56" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#demo-panel-grid)" />
        </svg>
      </div>
      <div
        className="pointer-events-none absolute -right-32 top-1/3 size-64 rounded-full bg-[#6BB4E8]/20 blur-3xl"
        aria-hidden
      />
    </>
  );
}

function DemoFormColumn() {
  return (
    <div className="relative bg-background px-6 py-12 sm:px-10 lg:px-12 lg:py-16 xl:px-16">
      <div
        className="pointer-events-none absolute -right-24 top-0 size-72 rounded-full bg-[#6BB4E8]/10 blur-3xl"
        aria-hidden
      />
      <FormGlow />
      <div className="relative mx-auto max-w-xl">
        <BookDemoForm />
      </div>
    </div>
  );
}

function FormGlow() {
  return (
    <div
      className="pointer-events-none absolute -left-12 bottom-24 size-56 rounded-full bg-[#0A4266]/5 blur-3xl dark:bg-[#6BB4E8]/5"
      aria-hidden
    />
  );
}
