"use client";

import {
  ArrowRight,
  Building2,
  DoorOpen,
  Plus,
  Rocket,
  ScrollText,
  Search,
  UserPlus,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import type { LandlordOnboardingStat } from "@/lib/onboarding/queries";
import { cn } from "@/lib/utils";

const CREATE_LANDLORD_HREF = "/dashboard/landlords/new?flow=onboarding";

function LandlordRow({ landlord }: { landlord: LandlordOnboardingStat }) {
  return (
    <Link
      href={`/dashboard/onboarding/landlord/${landlord.id}`}
      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-[#0A4266]/40 dark:border-border/80 dark:hover:border-[#6BB4E8]/40"
    >
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
          <span className="truncate">{landlord.name}</span>
          {landlord.code ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {landlord.code}
            </span>
          ) : null}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {landlord.company || "—"}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Building2 className="size-3.5" aria-hidden />
            {landlord.buildings} buildings
          </span>
          <span className="inline-flex items-center gap-1">
            <DoorOpen className="size-3.5" aria-hidden />
            {landlord.units} units
          </span>
          <span className="inline-flex items-center gap-1">
            <ScrollText className="size-3.5" aria-hidden />
            {landlord.activeLeases} active leases
          </span>
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-[#0A4266] dark:text-[#6BB4E8]">
        {landlord.buildings === 0 ? "Start setup" : "Continue"}
        <ArrowRight
          className="size-4 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export function AdminOnboardingHome({
  landlords,
}: {
  landlords: LandlordOnboardingStat[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return landlords;
    return landlords.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        (l.company?.toLowerCase().includes(q) ?? false) ||
        (l.code?.toLowerCase().includes(q) ?? false)
    );
  }, [landlords, search]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 md:p-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 dark:border-border/80 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
            <Rocket className="size-5" aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Onboarding
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Set up on behalf of a landlord
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Create a new landlord account and take them all the way through
            buildings, units, tenants and leases — or continue setting up an
            existing landlord.
          </p>
        </div>
        <Link
          href={CREATE_LANDLORD_HREF}
          className={cn(
            buttonVariants({ size: "lg" }),
            "rounded-full bg-[#0A4266] px-5 text-white hover:bg-[#0A4266]/90"
          )}
        >
          <UserPlus className="size-4" aria-hidden />
          Create a new landlord
        </Link>
      </header>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Existing landlords
          </h2>
          <div className="relative w-full sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search landlords…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 rounded-lg pl-9"
              aria-label="Search landlords"
            />
          </div>
        </div>

        {landlords.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-card p-10 text-center dark:border-border/80">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/15 dark:text-[#6BB4E8]">
              <UserPlus className="size-6" aria-hidden />
            </span>
            <div>
              <p className="text-base font-semibold text-foreground">
                Create your first landlord
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Landlords you create will appear here to continue onboarding.
              </p>
            </div>
            <Link
              href={CREATE_LANDLORD_HREF}
              className={cn(
                buttonVariants({ size: "lg" }),
                "rounded-full bg-[#0A4266] px-5 text-white hover:bg-[#0A4266]/90"
              )}
            >
              <Plus className="size-4" aria-hidden />
              Create a new landlord
            </Link>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground dark:border-border/80">
            No landlords match “{search}”.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((l) => (
              <LandlordRow key={l.id} landlord={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
