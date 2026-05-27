"use client";

import {
  AlertTriangle,
  Calculator,
  Clock4,
  Layers,
  MessageSquareWarning,
} from "lucide-react";
import Image from "next/image";

import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";

const PAIN_POINTS = [
  {
    icon: Calculator,
    title: "Manual billing wastes hours",
    description:
      "Caretakers chase readings, agents reconcile M-Pesa screenshots, and tenants dispute every invoice.",
    image: {
      src: "https://images.pexels.com/photos/9429372/pexels-photo-9429372.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop",
      alt: "Black property manager reviewing billing records on a laptop",
    },
  },
  {
    icon: MessageSquareWarning,
    title: "Endless utility disputes",
    description:
      "Without trusted meter data, every water bill becomes an argument that drags into next month.",
    image: {
      src: "https://images.pexels.com/photos/6457574/pexels-photo-6457574.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop",
      alt: "Black and multiethnic women discussing a payment document",
    },
  },
  {
    icon: Clock4,
    title: "Maintenance falls through cracks",
    description:
      "Tickets live in WhatsApp groups, callouts go missing, and small leaks become expensive repairs.",
    image: {
      src: "https://images.pexels.com/photos/5821000/pexels-photo-5821000.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop",
      alt: "Black maintenance workers repairing building infrastructure",
    },
  },
  {
    icon: Layers,
    title: "Disconnected tools",
    description:
      "Property logs in Excel, payments on a phone, WiFi on a separate router — nothing talks to anything.",
    image: {
      src: "https://images.pexels.com/photos/30688590/pexels-photo-30688590.jpeg?auto=compress&cs=tinysrgb&w=900&h=1200&fit=crop",
      alt: "African property team in Lagos working across laptops and phones",
    },
  },
] as const;

export function ProblemSection() {
  return (
    <section className="relative border-y border-border/70 bg-muted/30 py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              The reality of running property in Kenya
            </p>
          </FadeUp>
          <FadeUp delay={0.05}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              Your portfolio is growing.{" "}
              <span className="text-muted-foreground">
                Your tooling hasn&apos;t.
              </span>
            </h2>
          </FadeUp>
          <FadeUp delay={0.1}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              Most agencies and landlords still operate on a stack glued
              together with M-Pesa SMS, paper meters, and goodwill. It costs
              you money every month — and it doesn&apos;t scale.
            </p>
          </FadeUp>
        </div>

        <StaggerGroup
          stagger={0.07}
          className="mt-16 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {PAIN_POINTS.map(({ icon: Icon, title, description, image }) => (
            <FadeChild
              key={title}
              className="group relative min-h-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#062538] p-6 text-white shadow-[0_20px_60px_-35px_rgba(6,37,56,0.8)] transition-all hover:-translate-y-0.5 hover:border-white/25 hover:shadow-[0_25px_70px_-35px_rgba(6,37,56,0.95)]"
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
                className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-[#062538]/95 via-[#062538]/70 to-[#062538]/25"
                aria-hidden
              />
              <div
                className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(107,180,232,0.24),transparent_48%)]"
                aria-hidden
              />

              <div className="relative z-10 flex h-full min-h-[252px] flex-col justify-between gap-8">
                <div className="flex items-center justify-between">
                  <span className="grid size-10 place-items-center rounded-xl border border-white/15 bg-white/15 text-white backdrop-blur">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <AlertTriangle
                    className="size-4 text-white/65 transition-colors group-hover:text-[#7AB8D9]"
                    aria-hidden
                  />
                </div>

                <div>
                  <h3 className="text-base font-semibold text-white">
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/80">
                    {description}
                  </p>
                </div>
              </div>
            </FadeChild>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
