"use client";

import { ArrowRight, Droplets, ShieldCheck, Star, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { DashboardMockup } from "@/components/marketing/dashboard-mockup";
import {
  FadeUp,
  Floating,
  StaggerGroup,
  FadeChild,
} from "@/components/marketing/motion-primitives";
import { HERO_AVATARS } from "@/lib/marketing-images";
import { cn } from "@/lib/utils";

const TRUST_SIGNAL = [
  "Built for Kenyan landlords, estates, and agencies",
  "M-Pesa native · STS prepaid water · LONGi integration",
] as const;

export function HeroSection() {
  return (
    <section className="relative isolate overflow-hidden pt-12 sm:pt-16 lg:pt-24">
      <BackgroundGrid />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <FadeUp>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Now serving 14,000+ units across Kenya
            </div>
          </FadeUp>

          <FadeUp delay={0.06} className="mt-6">
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              The operating system for{" "}
              <span className="bg-gradient-to-br from-[#0A4266] via-[#1c5d89] to-[#6BB4E8] bg-clip-text text-transparent">
                modern property
              </span>{" "}
              portfolios.
            </h1>
          </FadeUp>

          <FadeUp delay={0.12} className="mx-auto mt-6 max-w-2xl">
            <p className="text-pretty text-base text-muted-foreground sm:text-lg">
              Mali Smart replaces spreadsheets, WhatsApp reconciliations, and
              utility headaches with one platform — smart water metering, rent
              collection, WiFi billing, and maintenance, all on M-Pesa.
            </p>
          </FadeUp>

          <FadeUp delay={0.18} className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href="/sign-up"
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#0A4266] px-6 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#083350] hover:shadow-lg sm:w-auto dark:bg-[#6BB4E8] dark:text-[#062538] dark:hover:bg-[#7AB8D9]"
            >
              Start with your portfolio
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
            <Link
              href="#platform"
              className="inline-flex h-12 w-full items-center justify-center rounded-full border border-border bg-background/80 px-6 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-muted sm:w-auto"
            >
              See how it works
            </Link>
          </FadeUp>

          <FadeUp delay={0.24} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-5">
            <PeopleStack />
            <div className="text-center sm:text-left">
              <div
                className="flex items-center justify-center gap-0.5 text-[#F5A524] sm:justify-start"
                aria-label="Rated 4.9 out of 5 by 240+ property teams"
              >
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className="size-3.5 fill-current"
                    aria-hidden
                  />
                ))}
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground">
                <span className="font-semibold text-foreground">4.9 / 5</span>{" "}
                from 240+ Kenyan property teams
              </p>
            </div>
          </FadeUp>

          <FadeUp delay={0.3} className="mt-5 text-xs text-muted-foreground">
            <p>{TRUST_SIGNAL[0]} · {TRUST_SIGNAL[1]}</p>
          </FadeUp>
        </div>

        {/* Hero visual */}
        <div className="relative mx-auto mt-14 max-w-6xl sm:mt-20">
          {/* Decorative glow */}
          <div
            className="pointer-events-none absolute inset-x-8 -top-10 -z-10 h-72 rounded-full bg-[radial-gradient(closest-side,rgba(107,180,232,0.35),transparent)] blur-3xl dark:bg-[radial-gradient(closest-side,rgba(107,180,232,0.18),transparent)]"
            aria-hidden
          />

          <FadeUp delay={0.1} amount={0.1}>
            <DashboardMockup />
          </FadeUp>

          {/* Floating analytic cards */}
          <Floating
            className="absolute -left-4 top-20 hidden w-56 sm:block lg:-left-10 lg:top-32"
            delay={0.4}
            range={6}
          >
            <StatCard
              icon={<Droplets className="size-4" aria-hidden />}
              label="Water vended today"
              value="18,420 L"
              delta="+6.1% vs. yesterday"
            />
          </Floating>

          <Floating
            className="absolute -right-4 top-44 hidden w-60 sm:block lg:-right-12 lg:top-56"
            delay={1}
            range={8}
            duration={6}
          >
            <StatCard
              icon={<TrendingUp className="size-4" aria-hidden />}
              label="Collected this month"
              value="KSh 4.82M"
              delta="+12.4% MoM"
              tone="primary"
            />
          </Floating>

          <Floating
            className="absolute -bottom-4 right-1/4 hidden w-52 lg:block"
            delay={0.7}
            range={5}
            duration={4.5}
          >
            <StatCard
              icon={<ShieldCheck className="size-4" aria-hidden />}
              label="Platform uptime"
              value="99.98%"
              delta="Last 90 days"
            />
          </Floating>
        </div>

        {/* Logos rail */}
        <FadeUp delay={0.15} className="mx-auto my-16 max-w-5xl text-center">
          <p className="text-md font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Trusted by property teams across Kenya
          </p>
          <StaggerGroup
            stagger={0.06}
            className="mt-6 grid grid-cols-2 items-center gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6"
          >
            {[
              "Karen Properties",
              "Tatu Estates",
              "Riverside Mews",
              "Westpark Holdings",
              "Ngong Heights",
              "Lavington Co.",
            ].map((name) => (
              <FadeChild
                key={name}
                className="text-sm font-semibold tracking-tight text-muted-foreground/80 transition-colors hover:text-foreground"
              >
                {name}
              </FadeChild>
            ))}
          </StaggerGroup>
        </FadeUp>
      </div>
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  delta,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
  tone?: "primary";
}) {
  const isPrimary = tone === "primary";
  return (
    <div
      className={
        isPrimary
          ? "rounded-2xl border border-[#0A4266]/15 bg-[#0A4266] p-4 text-white shadow-[0_20px_40px_-10px_rgba(10,66,102,0.45)] dark:border-[#6BB4E8]/30 dark:bg-[#0A4266]"
          : "rounded-2xl border border-border bg-background/95 p-4 shadow-[0_20px_40px_-10px_rgba(10,66,102,0.18)] backdrop-blur dark:bg-background/85"
      }
    >
      <div className="flex items-center justify-between">
        <span
          className={
            isPrimary
              ? "grid size-7 place-items-center rounded-lg bg-white/15 text-white"
              : "grid size-7 place-items-center rounded-lg bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]"
          }
        >
          {icon}
        </span>
        <span
          className={
            isPrimary
              ? "text-[10px] font-semibold uppercase tracking-wider text-white/70"
              : "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          }
        >
          Live
        </span>
      </div>
      <div
        className={
          isPrimary
            ? "mt-3 text-[10px] font-semibold uppercase tracking-wider text-white/70"
            : "mt-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
        }
      >
        {label}
      </div>
      <div
        className={
          isPrimary
            ? "mt-0.5 text-xl font-semibold text-white"
            : "mt-0.5 text-xl font-semibold text-foreground"
        }
      >
        {value}
      </div>
      <div
        className={
          isPrimary
            ? "mt-1 text-[11px] font-medium text-white/70"
            : "mt-1 text-[11px] font-medium text-muted-foreground"
        }
      >
        {delta}
      </div>
    </div>
  );
}

function PeopleStack() {
  return (
    <div
      className="flex -space-x-2"
      aria-label="Photos of Mali Smart customers"
    >
      {HERO_AVATARS.map((avatar, i) => (
        <span
          key={avatar.src}
          className={cn(
            "relative inline-block size-9 overflow-hidden rounded-full ring-2 ring-background",
            i === 0 && "z-[5]",
            i === 1 && "z-[4]",
            i === 2 && "z-[3]",
            i === 3 && "z-[2]",
            i >= 4 && "z-[1]"
          )}
        >
          <Image
            src={avatar.src}
            alt={avatar.alt}
            width={avatar.width}
            height={avatar.height}
            className="size-full object-cover"
          />
        </span>
      ))}
    </div>
  );
}

function BackgroundGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      aria-hidden
    >
      {/* Soft gradient wash */}
      <div className="absolute inset-x-0 top-0 h-[60%] bg-gradient-to-b from-[#0A4266]/[0.06] via-transparent to-transparent dark:from-[#6BB4E8]/[0.06]" />
      {/* Grid */}
      <svg
        className="absolute inset-0 h-full w-full text-foreground/[0.045] dark:text-foreground/[0.06]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="hero-grid"
            width="56"
            height="56"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M56 0H0V56"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
          <radialGradient id="grid-fade" cx="50%" cy="0%" r="80%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="grid-mask">
            <rect width="100%" height="100%" fill="url(#grid-fade)" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#hero-grid)"
          mask="url(#grid-mask)"
        />
      </svg>
    </div>
  );
}
