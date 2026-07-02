"use client";

import { Cpu, Gauge, KeyRound, Radio, ShieldAlert } from "lucide-react";
import Image from "next/image";

import { MobileMockup } from "@/components/marketing/mobile-mockup";
import {
  FadeChild,
  FadeUp,
  StaggerGroup,
} from "@/components/marketing/motion-primitives";
import { STS_HARDWARE_IMAGE } from "@/lib/marketing-images";

const FEATURES = [
  {
    icon: Gauge,
    title: "Split STS meter + valve",
    description:
      "A certified STS/DLMS meter with a remote-controllable valve sits at the riser — no tenant access, no tampering with the register.",
  },
  {
    icon: Cpu,
    title: "CIU with keypad backup",
    description:
      "The indoor Customer Interface Unit shows balance and units, and accepts 20-digit tokens by keypad even when the network is down.",
  },
  {
    icon: Radio,
    title: "Tokens auto-delivered",
    description:
      "The moment M-Pesa confirms, the 20-digit STS token is vended straight to the meter — tenants never type a code.",
  },
  {
    icon: ShieldAlert,
    title: "Tamper & reverse-flow alerts",
    description:
      "Magnetic tamper, reverse-flow, and low-balance events stream to operators in real time.",
  },
] as const;

export function StsMeteringSection() {
  return (
    <section
      id="sts-meters"
      className="relative overflow-hidden bg-background py-24 sm:py-28 lg:py-32"
    >
      {/* soft brand wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-gradient-to-b from-[#0A4266]/[0.05] to-transparent dark:from-[#6BB4E8]/[0.05]"
      />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <FadeUp>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0A4266] dark:text-[#7AB8D9]">
              STS prepaid metering
            </p>
          </FadeUp>
          <FadeUp delay={0.06}>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              STS meters and CIUs — without the keypad.
            </h2>
          </FadeUp>
          <FadeUp delay={0.12}>
            <p className="mt-5 text-pretty text-base text-muted-foreground sm:text-lg">
              Every unit gets a certified STS split meter and a Customer Interface
              Unit (CIU). Mali Smart delivers the 20-digit token to the meter the
              instant M-Pesa confirms — so tenants top up from their phone instead
              of typing codes into a keypad.
            </p>
          </FadeUp>
        </div>

        {/* Hardware + phone */}
        <div className="mt-16 grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left: hardware */}
          <FadeUp>
            <div className="relative">
              {/* hardware product shot */}
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-border bg-white shadow-[0_30px_80px_-20px_rgba(10,66,102,0.25)]">
                <Image
                  src={STS_HARDWARE_IMAGE.src}
                  alt={STS_HARDWARE_IMAGE.alt}
                  fill
                  sizes="(max-width: 1024px) 92vw, 46vw"
                  className="object-contain p-6"
                />
                <div className="pointer-events-none absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-[11px] font-medium text-foreground backdrop-blur">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  STS · DLMS-compliant hardware
                </div>
              </div>

              {/* device cards */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <MeterCard />
                <TokenConnector />
                <CiuCard />
              </div>
            </div>
          </FadeUp>

          {/* Right: phone */}
          <FadeUp delay={0.1}>
            <div className="relative">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 -z-10 mx-auto h-72 w-3/4 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(107,180,232,0.22),transparent)] blur-3xl dark:bg-[radial-gradient(closest-side,rgba(107,180,232,0.18),transparent)]"
              />
              <MobileMockup variant="tokens" />
              <p className="mx-auto mt-6 max-w-xs text-center text-sm text-muted-foreground">
                Tenants buy tokens on M-Pesa in seconds — the meter unlocks
                itself, no keypad typing.
              </p>
            </div>
          </FadeUp>
        </div>

        {/* Features */}
        <StaggerGroup
          stagger={0.06}
          className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <FadeChild
              key={title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-border/80"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-sm font-semibold text-foreground">
                {title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </FadeChild>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}

/** Stylized STS split water meter — outdoor register + remote valve. */
function MeterCard() {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-border/80"
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
            <Gauge className="size-4" aria-hidden />
          </span>
          <div className="text-xs font-semibold text-foreground">
            STS split meter
          </div>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          LONGi
        </span>
      </div>

      {/* LCD */}
      <div className="mt-3 rounded-xl bg-[#0A4266] p-3 text-white dark:bg-[#06283f]">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-white/60">
          Total consumption
        </div>
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums tracking-tight">
          0142.6 m³
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Valve</span>
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" /> Open
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Meter no.</span>
          <span className="font-mono font-semibold text-foreground">
            4471 8820
          </span>
        </div>
      </div>
    </div>
  );
}

/** Stylized Customer Interface Unit — indoor balance display + token keypad. */
function CiuCard() {
  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-sm dark:border-border/80"
      aria-hidden
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
            <Cpu className="size-4" aria-hidden />
          </span>
          <div className="text-xs font-semibold text-foreground">CIU · keypad</div>
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Indoor
        </span>
      </div>

      {/* LCD balance */}
      <div className="mt-3 rounded-xl bg-[#0A4266] p-3 text-white dark:bg-[#06283f]">
        <div className="flex items-center justify-between text-[9px] font-semibold uppercase tracking-wider text-white/60">
          <span>Balance</span>
          <span>128 units</span>
        </div>
        <div className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
          2,140 L
        </div>
      </div>

      {/* keypad */}
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map(
          (k) => (
            <span
              key={k}
              className="grid h-6 place-items-center rounded-md border border-border bg-muted/50 text-[11px] font-semibold text-muted-foreground"
            >
              {k}
            </span>
          )
        )}
      </div>
    </div>
  );
}

/** Labeled link between the meter and the CIU — the 20-digit STS token. */
function TokenConnector() {
  return (
    <div
      className="flex items-center justify-center gap-2 sm:flex-col"
      aria-hidden
    >
      <span
        className="h-px w-8 bg-gradient-to-r from-transparent to-[#6BB4E8]/50 sm:h-6 sm:w-px sm:bg-gradient-to-b"
        aria-hidden
      />
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[#6BB4E8]/40 bg-[#6BB4E8]/10 px-2.5 py-1 text-[10px] font-semibold text-[#0A4266] dark:text-[#7AB8D9]">
        <KeyRound className="size-3" aria-hidden />
        20-digit token
      </span>
      <span
        className="h-px w-8 bg-gradient-to-l from-transparent to-[#6BB4E8]/50 sm:h-6 sm:w-px sm:bg-gradient-to-t"
        aria-hidden
      />
    </div>
  );
}
