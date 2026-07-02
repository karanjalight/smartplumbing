"use client";

import { ArrowRight, ChevronDown, Droplets, Star, TrendingUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { InstallAppButton } from "@/components/marketing/install-app-button";
import { FadeUp, Floating } from "@/components/marketing/motion-primitives";
import { HERO_AVATARS, HERO_BACKDROPS } from "@/lib/marketing-images";
import { cn } from "@/lib/utils";

const TRUST_SIGNAL =
  "Built for Kenyan landlords, estates, and agencies · M-Pesa native · STS prepaid water · LONGi integration";

export function HeroSection() {
  return (
    <>
      {/* ---------- Cinematic hero ---------- */}
      <section className="relative isolate -mt-16 flex min-h-[88svh] flex-col justify-center overflow-hidden sm:-mt-20 lg:min-h-[92svh]">
        <HeroCarousel images={HERO_BACKDROPS} />

        {/* Brand scrim — keeps white text legible over any frame */}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#04141f] via-[#062538]/80 to-[#062538]/55"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#04141f]/90 via-[#062538]/45 to-transparent"
        />

        <div className="relative mx-auto w-full max-w-7xl px-4 pt-24 pb-24 sm:px-6 lg:px-8 lg:pt-28">
          <div className="max-w-2xl">
            <FadeUp>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Now serving 14,000+ units across Kenya
              </span>
            </FadeUp>

            <FadeUp delay={0.06} className="mt-6">
              <h1 className="text-balance text-4xl font-semibold leading-[1.04] tracking-tight text-white sm:text-4xl lg:text-5xl xl:text-6xl">
                Collect rent and bill water —{" "}
                <span className="text-[#7AB8D9]">automatically, on M-Pesa</span>.
              </h1>
            </FadeUp>

            <FadeUp delay={0.12} className="mt-6 max-w-xl">
              <p className="text-pretty text-base text-white/75 sm:text-lg">
                Mali Smart is the operating system for Kenyan rentals — prepaid
                smart water, rent collection, WiFi billing, and maintenance in one
                platform. Built in Nairobi for landlords, estates, and agencies.
              </p>
            </FadeUp>

            <FadeUp
              delay={0.18}
              className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
            >
              <InstallAppButton
                fallbackHref="/sign-up"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#062538] shadow-lg shadow-black/20 transition-all hover:bg-[#e8f2fa] hover:shadow-xl"
              />
              <Link
                href="/book-demo"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                Book a demo
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </FadeUp>

            <FadeUp delay={0.22} className="mt-5">
              <Link
                href="#how-it-works"
                className="inline-flex items-center gap-1 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                See how it works
                <ChevronDown className="size-4" aria-hidden />
              </Link>
            </FadeUp>

            <FadeUp
              delay={0.24}
              className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5"
            >
              <PeopleStack />
              <div className="text-center sm:text-left">
                <div
                  className="flex items-center justify-center gap-0.5 text-[#F5A524] sm:justify-start"
                  aria-label="Rated 4.9 out of 5 by 240+ property teams"
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="size-3.5 fill-current" aria-hidden />
                  ))}
                </div>
                <p className="mt-1 text-xs font-medium text-white/70">
                  <span className="font-semibold text-white">4.9 / 5</span> from
                  240+ Kenyan property teams
                </p>
              </div>
            </FadeUp>

            <FadeUp delay={0.3} className="mt-6 max-w-lg text-xs text-white/55">
              {TRUST_SIGNAL}
            </FadeUp>
          </div>
        </div>

        {/* Floating live-data cards over the photo */}
        <Floating
          className="absolute top-32 right-6 hidden w-56 xl:block"
          delay={0.4}
          range={7}
        >
          <GlassStat
            icon={<Droplets className="size-4" aria-hidden />}
            label="Water vended today"
            value="18,420 L"
            delta="+6.1% vs. yesterday"
          />
        </Floating>
        <Floating
          className="absolute right-16 bottom-28 hidden w-60 xl:block"
          delay={1}
          range={9}
          duration={6}
        >
          <GlassStat
            icon={<TrendingUp className="size-4" aria-hidden />}
            label="Collected this month"
            value="KSh 4.82M"
            delta="+12.4% MoM"
          />
        </Floating>
      </section>
    </>
  );
}

function GlassStat({
  icon,
  label,
  value,
  delta,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: string;
}) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-[0_24px_50px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="grid size-7 place-items-center rounded-lg bg-white/15 text-white">
          {icon}
        </span>
        <span className="text-[10px] font-semibold tracking-wider text-white/60 uppercase">
          Live
        </span>
      </div>
      <div className="mt-3 text-[10px] font-semibold tracking-wider text-white/60 uppercase">
        {label}
      </div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-emerald-300">{delta}</div>
    </div>
  );
}

function PeopleStack() {
  return (
    <div className="flex -space-x-2" aria-label="Photos of Mali Smart customers">
      {HERO_AVATARS.map((avatar, i) => (
        <span
          key={avatar.src}
          className={cn(
            "relative inline-block size-9 overflow-hidden rounded-full ring-2 ring-white/70",
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
