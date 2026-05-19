"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Platform", href: "/platform" },
  { label: "Metering", href: "/metering" },
  { label: "Residents", href: "/residents" },
  { label: "Operators", href: "/operators" },
  { label: "Trust", href: "/trust" },
] as const;

/**
 * `variant="default"`  — dark text on transparent/light backgrounds (homepage).
 * `variant="overlay"`  — white text on a dark hero photo (sub-pages).
 *
 * When the user scrolls past the hero, both variants fade to the same
 * frosted `bg-background/85 backdrop-blur` look so the nav stays legible
 * over light content below.
 */
type MarketingNavProps = {
  variant?: "default" | "overlay";
};

export function MarketingNav({ variant = "default" }: MarketingNavProps) {
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const isOverlay = variant === "overlay";
  /** Show the overlay (white-on-dark) treatment only at the top of the page. */
  const onDark = isOverlay && !scrolled && !open;

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-colors duration-300",
        scrolled || open
          ? "border-b border-border/70 bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70"
          : isOverlay
            ? "border-b border-white/10 bg-transparent"
            : "border-b border-transparent bg-transparent"
      )}
      role="banner"
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6 lg:px-8">
        <Link
          href="/"
          className={cn(
            "inline-flex shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            onDark
              ? "focus-visible:ring-white/50"
              : "focus-visible:ring-[#0A4266] dark:focus-visible:ring-[#7AB8D9]"
          )}
          aria-label="Smart Plumbing — Home"
        >
          <BrandLogo
            variant="compact"
            imageClassName="h-9 w-auto sm:h-10"
            withSurface={false}
          />
          <span
            className={cn(
              "hidden text-sm font-semibold tracking-tight sm:inline",
              onDark ? "text-white" : "text-foreground"
            )}
          >
            Smart Plumbing
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                onDark
                  ? "text-white/80 hover:text-white focus-visible:ring-white/50"
                  : "text-muted-foreground hover:text-foreground focus-visible:ring-[#0A4266] dark:focus-visible:ring-[#7AB8D9]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle
            className={cn(
              "hidden size-10 sm:inline-flex",
              onDark &&
                "border-white/25 bg-white/[0.06] text-white hover:bg-white/15"
            )}
          />
          <Link
            href="/auth/login"
            className={cn(
              "hidden h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors sm:inline-flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              onDark
                ? "border-white/25 bg-white/[0.05] text-white backdrop-blur hover:bg-white/15 focus-visible:ring-white/50"
                : "border-border bg-background text-foreground hover:bg-muted focus-visible:ring-[#0A4266] dark:focus-visible:ring-[#7AB8D9]"
            )}
          >
            Sign in
          </Link>
          <Link
            href="/book-demo"
            className={cn(
              "group inline-flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              onDark
                ? "bg-white text-[#0A4266] hover:bg-[#7AB8D9] hover:text-[#062538] focus-visible:ring-white/50"
                : "bg-[#0A4266] text-white hover:bg-[#083350] hover:shadow-md focus-visible:ring-[#0A4266] dark:bg-[#6BB4E8] dark:text-[#062538] dark:hover:bg-[#7AB8D9] dark:focus-visible:ring-[#7AB8D9]"
            )}
          >
            Book a demo
            <ArrowUpRight
              className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "inline-flex size-10 items-center justify-center rounded-full border lg:hidden",
              onDark
                ? "border-white/25 bg-white/[0.05] text-white backdrop-blur"
                : "border-border bg-background text-foreground"
            )}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-background/95 backdrop-blur-xl lg:hidden">
          <nav
            aria-label="Mobile"
            className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 sm:px-6"
          >
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-xl px-3 py-3 text-base font-medium text-foreground hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 flex items-center gap-2 border-t border-border pt-4">
              <Link
                href="/auth/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 flex-1 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold text-foreground"
              >
                Sign in
              </Link>
              <ThemeToggle className="size-11" />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
