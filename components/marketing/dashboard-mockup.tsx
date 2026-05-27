"use client";

import {
  ArrowUpRight,
  Building2,
  Droplets,
  Receipt,
  Search,
  Wifi,
} from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Lightweight, dependency-free dashboard mockup used in the hero section.
 *
 * All numbers are illustrative ("real Kenyan property-tech copywriting").
 * The chart is hand-drawn with a single SVG path so it renders crisply on any
 * device without needing a chart runtime.
 */
export function DashboardMockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-3xl border border-border bg-background shadow-[0_30px_80px_-20px_rgba(10,66,102,0.25)] dark:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]",
        className
      )}
      aria-hidden
    >
      {/* Top window chrome */}
      <div className="flex items-center justify-between border-b border-border/70 bg-muted/50 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#FF5F57]/80" />
          <span className="size-2.5 rounded-full bg-[#FEBC2E]/80" />
          <span className="size-2.5 rounded-full bg-[#28C840]/80" />
        </div>
        <div className="flex h-7 max-w-[260px] flex-1 items-center gap-2 rounded-md border border-border/80 bg-background px-3 text-[11px] text-muted-foreground sm:max-w-[320px]">
          <Search className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">app.malismart.co.ke/portfolio</span>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <div className="size-6 rounded-full bg-gradient-to-br from-[#0A4266] to-[#6BB4E8] text-[10px] font-semibold text-white grid place-items-center">
            AM
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden w-48 shrink-0 border-r border-border/70 bg-muted/30 p-4 sm:block">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspace
          </div>
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2.5 py-2">
            <div className="grid size-7 place-items-center rounded-md bg-[#0A4266] text-[11px] font-bold text-white">
              KP
            </div>
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-foreground">
                Karen Properties
              </div>
              <div className="text-[10px] text-muted-foreground">14 buildings</div>
            </div>
          </div>

          <nav className="mt-5 space-y-1">
            {(
              [
                { label: "Overview", active: true },
                { label: "Buildings", count: "14" },
                { label: "Meters", count: "612" },
                { label: "Tenants", count: "486" },
                { label: "Finance" },
                { label: "Maintenance", count: "9" },
                { label: "WiFi" },
                { label: "Reports" },
              ] as Array<{ label: string; active?: boolean; count?: string }>
            ).map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs",
                  item.active
                    ? "bg-[#0A4266] text-white"
                    : "text-foreground/80"
                )}
              >
                <span>{item.label}</span>
                {item.count ? (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      item.active
                        ? "bg-white/15 text-white"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.count}
                  </span>
                ) : null}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main panel */}
        <div className="min-w-0 flex-1 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Portfolio overview
              </div>
              <div className="mt-0.5 text-base font-semibold text-foreground sm:text-lg">
                November snapshot
              </div>
            </div>
            <div className="hidden items-center gap-1.5 rounded-full border border-border/80 bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Live sync
            </div>
          </div>

          {/* KPI grid */}
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <KpiCard
              label="Collected this month"
              value="KSh 4.82M"
              delta="+12.4%"
              positive
            />
            <KpiCard
              label="Water vended"
              value="18,420 L"
              delta="+6.1%"
              positive
            />
            <KpiCard
              label="Active meters"
              value="612 / 612"
              delta="100%"
              positive
            />
            <KpiCard
              label="Open tickets"
              value="9"
              delta="-32%"
              positive
            />
          </div>

          {/* Chart */}
          <div className="mt-4 rounded-2xl border border-border/70 bg-background p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Cash flow · last 30 days
                </div>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-xl font-semibold text-foreground sm:text-2xl">
                    KSh 4,821,300
                  </span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    +12.4%
                  </span>
                </div>
              </div>
              <div className="hidden gap-1 sm:flex">
                {(["7D", "30D", "12M"] as const).map((p, i) => (
                  <span
                    key={p}
                    className={cn(
                      "rounded-md px-2 py-1 text-[11px] font-medium",
                      i === 1
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    )}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            <Sparkline className="mt-3" />
          </div>

          {/* Live activity */}
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Live activity
                </div>
                <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              <ul className="mt-3 space-y-2.5">
                <ActivityRow
                  icon={<Droplets className="size-3.5" aria-hidden />}
                  title="Tokens vended · M-201"
                  meta="Mukami W. · 2 m ago"
                  amount="KSh 300"
                />
                <ActivityRow
                  icon={<Receipt className="size-3.5" aria-hidden />}
                  title="Rent received · Block C"
                  meta="House 14 · 9 m ago"
                  amount="KSh 28,000"
                />
                <ActivityRow
                  icon={<Wifi className="size-3.5" aria-hidden />}
                  title="WiFi top-up · Unit 4B"
                  meta="Brian K. · 14 m ago"
                  amount="KSh 500"
                />
              </ul>
            </div>

            <div className="rounded-2xl border border-border/70 bg-background p-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Buildings
                </div>
                <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
              </div>
              <ul className="mt-3 space-y-2.5">
                {[
                  { name: "Karen Springs", meters: 96, occ: 98 },
                  { name: "Riverside Mews", meters: 72, occ: 94 },
                  { name: "Tatu Heights", meters: 120, occ: 91 },
                ].map((b) => (
                  <li
                    key={b.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-foreground">
                        {b.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {b.meters} meters · {b.occ}% occupied
                      </div>
                    </div>
                    <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#0A4266] to-[#6BB4E8]"
                        style={{ width: `${b.occ}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  positive,
}: {
  label: string;
  value: string;
  delta: string;
  positive?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background p-3 sm:p-3.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-foreground sm:text-base">
          {value}
        </span>
        <span
          className={cn(
            "text-[10px] font-semibold",
            positive
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-destructive"
          )}
        >
          {delta}
        </span>
      </div>
    </div>
  );
}

function ActivityRow({
  icon,
  title,
  meta,
  amount,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  amount: string;
}) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-foreground">
            {title}
          </div>
          <div className="text-[10px] text-muted-foreground">{meta}</div>
        </div>
      </div>
      <span className="shrink-0 text-xs font-semibold text-foreground">
        {amount}
      </span>
    </li>
  );
}

function Sparkline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 140"
      className={cn("h-28 w-full sm:h-32", className)}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="splArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#0A4266" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0A4266" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="splStroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#0A4266" />
          <stop offset="100%" stopColor="#6BB4E8" />
        </linearGradient>
      </defs>
      <g>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            x2="600"
            y1={20 + i * 30}
            y2={20 + i * 30}
            className="stroke-border"
            strokeDasharray="2 4"
            strokeOpacity="0.6"
          />
        ))}
      </g>
      <path
        d="M0,108 C40,98 70,86 110,82 C150,78 180,96 220,90 C260,84 300,58 340,52 C380,46 420,68 460,60 C500,52 530,28 570,22 L600,18 L600,140 L0,140 Z"
        fill="url(#splArea)"
      />
      <path
        d="M0,108 C40,98 70,86 110,82 C150,78 180,96 220,90 C260,84 300,58 340,52 C380,46 420,68 460,60 C500,52 530,28 570,22 L600,18"
        fill="none"
        stroke="url(#splStroke)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="570" cy="22" r="4" fill="#0A4266" />
      <circle cx="570" cy="22" r="9" fill="#6BB4E8" fillOpacity="0.2" />
    </svg>
  );
}
