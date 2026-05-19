"use client";

import { Quote } from "lucide-react";
import Image from "next/image";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";
import { TESTIMONIALS } from "@/lib/marketing-images";
import { cn } from "@/lib/utils";

export function TestimonialsSection() {
  return (
    <section
      id="testimonials"
      className="relative py-24 sm:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              Loved by Kenyan property teams
            </p>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              The operators, landlords, and residents who switched —{" "}
              <span className="text-muted-foreground">
                aren&apos;t going back.
              </span>
            </h2>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.08}
          className="mt-16 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {TESTIMONIALS.map((t, i) => {
            const featured = i === 1;
            return (
              <FadeChild
                key={t.name}
                className={cn(
                  "group relative flex h-full flex-col justify-between rounded-3xl border p-7 transition-all hover:-translate-y-0.5 sm:p-8",
                  featured
                    ? "border-transparent bg-gradient-to-br from-[#0A4266] to-[#0d3854] text-white shadow-[0_25px_60px_-25px_rgba(10,66,102,0.55)]"
                    : "border-border bg-background hover:border-foreground/20 hover:shadow-[0_25px_60px_-25px_rgba(10,66,102,0.18)]"
                )}
              >
                <div className="relative">
                  <Quote
                    className={cn(
                      "size-7",
                      featured
                        ? "text-white/30"
                        : "text-[#0A4266]/15 dark:text-[#6BB4E8]/25"
                    )}
                    aria-hidden
                  />
                  <blockquote
                    className={cn(
                      "mt-5 text-pretty text-base leading-relaxed",
                      featured ? "text-white" : "text-foreground"
                    )}
                  >
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                </div>

                <div
                  className={cn(
                    "mt-8 flex items-center gap-3 border-t pt-6",
                    featured ? "border-white/15" : "border-border"
                  )}
                >
                  <span className="relative inline-block size-11 shrink-0 overflow-hidden rounded-full ring-2 ring-background">
                    <Image
                      src={t.photo.src}
                      alt={t.photo.alt}
                      width={t.photo.width}
                      height={t.photo.height}
                      className="size-full object-cover"
                    />
                  </span>
                  <div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        featured ? "text-white" : "text-foreground"
                      )}
                    >
                      {t.name}
                    </div>
                    <div
                      className={cn(
                        "mt-0.5 text-xs",
                        featured ? "text-white/70" : "text-muted-foreground"
                      )}
                    >
                      {t.title}
                    </div>
                  </div>
                </div>
              </FadeChild>
            );
          })}
        </StaggerGroup>
      </div>
    </section>
  );
}
