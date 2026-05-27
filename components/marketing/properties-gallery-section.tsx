"use client";

import { Building2, MapPin } from "lucide-react";
import Image from "next/image";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";
import { PROPERTY_GALLERY } from "@/lib/marketing-images";

export function PropertiesGallerySection() {
  return (
    <section className="relative py-24 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <FadeUp>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
                On Mali Smart today
              </p>
            </FadeUp>
            <FadeUp delay={0.06}>
              <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                Real buildings.{" "}
                <span className="text-muted-foreground">Real tenants.</span>{" "}
                Live data.
              </h2>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
                From single landlords with one block to estates managing
                hundreds of units, Mali Smart runs the day-to-day of
                modern Kenyan housing.
              </p>
            </FadeUp>
          </div>

          <FadeUp delay={0.12} className="hidden lg:block">
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted/50 px-4 py-3">
              <Building2
                className="size-5 text-[#0A4266] dark:text-[#7AB8D9]"
                aria-hidden
              />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Buildings live
                </div>
                <div className="text-lg font-semibold text-foreground">
                  320+ &amp; counting
                </div>
              </div>
            </div>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.08}
          className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {PROPERTY_GALLERY.map((p, i) => (
            <FadeChild
              key={p.name}
              className="group relative overflow-hidden rounded-3xl border border-border bg-muted shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_25px_60px_-25px_rgba(10,66,102,0.35)]"
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden">
                <Image
                  src={p.image.src}
                  alt={p.image.alt}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                  priority={i === 0}
                />
                {/* Bottom gradient for legibility */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-[#062538]/95 via-[#062538]/40 to-transparent"
                  aria-hidden
                />
                {/* Top status pill */}
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white backdrop-blur">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Live
                </span>
              </div>

              {/* Caption */}
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="text-base font-semibold text-white">
                  {p.name}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-xs text-white/75">
                  <MapPin className="size-3" aria-hidden />
                  {p.meta}
                </div>
              </div>
            </FadeChild>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
