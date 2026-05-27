"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FadeUp } from "@/components/marketing/motion-primitives";
import {
  PAGE_HERO_IMAGES,
  type MarketingImage,
  type PageHeroKey,
} from "@/lib/marketing-images";
import { cn } from "@/lib/utils";

type PageHeroCta = {
  label: string;
  href: string;
  variant?: "primary" | "ghost";
};

type PageHeroProps = {
  /** Key into `PAGE_HERO_IMAGES`. Falls back to a manual `image` prop. */
  imageKey?: PageHeroKey;
  /** Explicit override if you need a non-catalog background photo. */
  image?: MarketingImage;
  /** Small uppercase label above the headline (e.g. "Platform"). */
  eyebrow: string;
  /** Main H1 — keep it short and punchy. */
  title: React.ReactNode;
  /** One-line subtitle below the headline. */
  description: string;
  /** Up to two CTAs. Primary is filled, ghost is outlined. */
  ctas?: PageHeroCta[];
  /** Optional list of trust chips rendered below the CTAs. */
  trustChips?: readonly string[];
  /** Optional alignment override. */
  align?: "left" | "center";
};

/**
 * Cinematic page hero with a real photographic background.
 *
 * Design notes:
 *   - The photo loads with `priority` so the LCP is the hero image.
 *   - A two-layer scrim (brand gradient + radial fade) guarantees
 *     WCAG-AA text contrast regardless of the subject of the photo.
 *   - A faint SVG grid pattern + soft glow tie the hero into the rest
 *     of the marketing site (matches the homepage hero treatment).
 */
export function PageHero({
  imageKey,
  image,
  eyebrow,
  title,
  description,
  ctas = [],
  trustChips,
  align = "left",
}: PageHeroProps) {
  const photo: MarketingImage = image ?? PAGE_HERO_IMAGES[imageKey ?? "platform"];

  return (
    <section
      aria-labelledby="page-hero-title"
      /*
       * Negative top margin pulls the hero up so it sits *under* the sticky
       * `<MarketingNav>` (h-16 on mobile, h-20 on ≥sm). The nav itself is
       * z-50 so it floats on top of the dark photo — white nav text stays
       * legible without us needing to paint a flat background under it.
       *
       * Content inside the hero is offset back down via `pt-32 sm:pt-36
       * lg:pt-44` so the headline never hides behind the nav.
       */
      className="relative isolate -mt-16 overflow-hidden sm:-mt-20"
    >
      {/* Background photo */}
      <Image
        src={photo.src}
        alt={photo.alt}
        fill
        priority
        sizes="100vw"
        className="object-cover object-center -z-30"
      />

      {/* Brand gradient scrim */}
      <div
        className="absolute inset-0 -z-20 bg-gradient-to-br from-[#062538]/95 via-[#0A4266]/85 to-[#062538]/70"
        aria-hidden
      />

      {/* Radial vignette for extra legibility on the left edge */}
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(6,37,56,0.35),transparent_55%)]"
        aria-hidden
      />

      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07]"
        aria-hidden
      >
        <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern
              id="page-hero-grid"
              width="56"
              height="56"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M56 0H0V56"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#page-hero-grid)" />
        </svg>
      </div>

      <div
        className={cn(
          "relative mx-auto flex w-full max-w-7xl flex-col px-4 pb-24 pt-32 sm:px-6 sm:pb-28 sm:pt-36 lg:px-8 lg:pb-36 lg:pt-44",
          align === "center" && "items-center text-center"
        )}
      >
        {/* Breadcrumb */}
        <FadeUp>
          <nav
            aria-label="Breadcrumb"
            className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-white/70"
          >
            <Link
              href="/"
              className="rounded-md underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#062538]"
            >
              Mali Smart
            </Link>
            <ChevronRight className="size-3.5 opacity-60" aria-hidden />
            <span className="text-white">{eyebrow}</span>
          </nav>
        </FadeUp>

        <FadeUp delay={0.05}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#7AB8D9]">
            {eyebrow}
          </p>
        </FadeUp>

        <FadeUp delay={0.1}>
          <h1
            id="page-hero-title"
            className={cn(
              "mt-4 max-w-4xl text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-[3.75rem]",
              align === "center" && "mx-auto"
            )}
          >
            {title}
          </h1>
        </FadeUp>

        <FadeUp delay={0.16}>
          <p
            className={cn(
              "mt-6 max-w-2xl text-pretty text-base text-white/80 sm:text-lg",
              align === "center" && "mx-auto"
            )}
          >
            {description}
          </p>
        </FadeUp>

        {ctas.length > 0 && (
          <FadeUp
            delay={0.22}
            className={cn(
              "mt-9 flex flex-col gap-3 sm:flex-row sm:gap-4",
              align === "center" && "sm:justify-center"
            )}
          >
            {ctas.map((cta) =>
              cta.variant === "ghost" ? (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 bg-white/[0.05] px-6 text-sm font-semibold text-white backdrop-blur transition-colors hover:bg-white/10"
                >
                  {cta.label}
                </Link>
              ) : (
                <Link
                  key={cta.href}
                  href={cta.href}
                  className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#0A4266] shadow-sm transition-all hover:gap-2.5 hover:bg-[#7AB8D9] hover:text-[#062538]"
                >
                  {cta.label}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              )
            )}
          </FadeUp>
        )}

        {trustChips && trustChips.length > 0 && (
          <FadeUp
            delay={0.28}
            className={cn(
              "mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-white/70",
              align === "center" && "justify-center"
            )}
          >
            {trustChips.map((chip, i) => (
              <span key={chip} className="inline-flex items-center gap-2">
                {i > 0 && (
                  <span className="size-1 rounded-full bg-white/30" aria-hidden />
                )}
                {chip}
              </span>
            ))}
          </FadeUp>
        )}
      </div>
    </section>
  );
}
