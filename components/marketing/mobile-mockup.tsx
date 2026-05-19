"use client";

import { ArrowRight, Droplets, Home, Wifi, Wrench } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tenant mobile app mockup. Renders as a stylized phone frame with rounded
 * corners and an in-app screenshot. Purely decorative (aria-hidden).
 */
export function MobileMockup({
  className,
  variant = "tokens",
}: {
  className?: string;
  variant?: "tokens" | "rent" | "maintenance";
}) {
  return (
    <div
      className={cn(
        "relative mx-auto w-full max-w-[280px] sm:max-w-[300px]",
        className
      )}
      aria-hidden
    >
      <div className="relative rounded-[2.4rem] border border-border bg-foreground/95 p-2 shadow-[0_30px_80px_-20px_rgba(10,66,102,0.35)] dark:bg-zinc-900">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-background">
          {/* notch */}
          <div className="pointer-events-none absolute left-1/2 top-2.5 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-foreground/95 dark:bg-zinc-900" />

          {/* status bar */}
          <div className="flex items-center justify-between px-6 pt-4 text-[10px] font-semibold text-foreground">
            <span>9:41</span>
            <div className="flex items-center gap-1 opacity-60">
              <span className="size-1 rounded-full bg-current" />
              <span className="size-1 rounded-full bg-current" />
              <span className="size-1 rounded-full bg-current" />
              <span>Safaricom</span>
            </div>
          </div>

          {variant === "tokens" && <TokensScreen />}
          {variant === "rent" && <RentScreen />}
          {variant === "maintenance" && <MaintenanceScreen />}
        </div>
      </div>
    </div>
  );
}

function TokensScreen() {
  return (
    <div className="p-5 pt-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            House 14B
          </div>
          <div className="text-base font-semibold text-foreground">Hi, Mukami</div>
        </div>
        <div className="size-9 rounded-full bg-gradient-to-br from-[#0A4266] to-[#6BB4E8] text-xs font-bold text-white grid place-items-center">
          MW
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0A4266] to-[#15527d] p-4 text-white dark:from-[#0A4266] dark:to-[#0a3454]">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-white/70">
          <span>Water balance</span>
          <Droplets className="size-3.5" aria-hidden />
        </div>
        <div className="mt-1 text-2xl font-semibold">2,140 L</div>
        <div className="mt-1 text-[11px] text-white/70">
          ≈ 9 days at current usage
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-[62%] rounded-full bg-[#6BB4E8]" />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <QuickAction label="Buy water" sub="From KSh 50" />
        <QuickAction label="Pay rent" sub="Due in 4 days" />
        <QuickAction label="WiFi" sub="Top up" />
        <QuickAction label="Report" sub="Maintenance" />
      </div>

      <div className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recent
      </div>
      <ul className="mt-2 space-y-2">
        {[
          { t: "Water tokens", a: "+1,200 L", n: "M-Pesa · 04:18" },
          { t: "Rent payment", a: "KSh 28,000", n: "M-Pesa · Nov 02" },
        ].map((r) => (
          <li
            key={r.t}
            className="flex items-center justify-between rounded-xl border border-border/70 bg-background px-3 py-2"
          >
            <div>
              <div className="text-[11px] font-semibold text-foreground">
                {r.t}
              </div>
              <div className="text-[9px] text-muted-foreground">{r.n}</div>
            </div>
            <span className="text-[11px] font-semibold text-foreground">{r.a}</span>
          </li>
        ))}
      </ul>

      <NavBar />
    </div>
  );
}

function RentScreen() {
  return (
    <div className="p-5 pt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        November rent
      </div>
      <div className="mt-1 text-2xl font-semibold text-foreground">
        KSh 28,000
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        Due Friday · House 14B, Karen Springs
      </div>

      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-3.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Payment method
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/15 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              M-P
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                M-Pesa · 07** ***412
              </div>
              <div className="text-[10px] text-muted-foreground">
                Linked Aug 2024
              </div>
            </div>
          </div>
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      <button
        type="button"
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#0A4266] text-sm font-semibold text-white"
      >
        Pay KSh 28,000
      </button>

      <div className="mt-3 text-[10px] text-muted-foreground">
        Instant receipt · split with co-tenant
      </div>

      <NavBar />
    </div>
  );
}

function MaintenanceScreen() {
  return (
    <div className="p-5 pt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Maintenance
      </div>
      <div className="mt-1 text-2xl font-semibold text-foreground">
        Report an issue
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {([
          { label: "Plumbing", icon: Droplets },
          { label: "Electrical", icon: Wrench },
          { label: "Internet", icon: Wifi },
          { label: "Other", icon: Wrench },
        ] as const).map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              type="button"
              className="flex flex-col items-start gap-2 rounded-2xl border border-border bg-background p-3 text-left"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
                <Icon className="size-3.5" aria-hidden />
              </span>
              <span className="text-xs font-semibold text-foreground">
                {c.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-2xl border border-border/70 bg-muted/40 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Active ticket
        </div>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-foreground">
              Kitchen tap leak
            </div>
            <div className="text-[10px] text-muted-foreground">
              Plumber dispatched · ETA 1h 10m
            </div>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
            On the way
          </span>
        </div>
      </div>

      <NavBar />
    </div>
  );
}

function QuickAction({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background p-3">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function NavBar() {
  return (
    <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-2.5">
      {[
        { icon: Home, active: true },
        { icon: Droplets },
        { icon: Wifi },
        { icon: Wrench },
      ].map(({ icon: Icon, active }, i) => (
        <span
          key={i}
          className={cn(
            "grid size-9 place-items-center rounded-full",
            active ? "bg-[#0A4266] text-white" : "text-muted-foreground"
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      ))}
    </div>
  );
}
