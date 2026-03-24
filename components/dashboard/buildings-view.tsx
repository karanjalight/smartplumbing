"use client";

import { Building2, ChevronRight, Layers, MapPin, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBuildingListDisplay,
  getBuildings,
  rentSummary,
} from "@/lib/buildings-data";
import { cn } from "@/lib/utils";

export function BuildingsView() {
  const rows = useMemo(
    () => getBuildings().map((b) => getBuildingListDisplay(b)),
    []
  );
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.city.toLowerCase().includes(s) ||
        r.addressLine.toLowerCase().includes(s) ||
        r.landlordCompany.toLowerCase().includes(s) ||
        r.caretakerName.toLowerCase().includes(s) ||
        r.id.toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="space-y-8 pb-8">
      <header className="flex flex-col gap-6 border-b border-border pb-6 md:flex-row md:items-end md:justify-between dark:border-border/80">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
            <Layers className="size-8" />
            <h1 className="text-2xl font-bold tracking-tight">Buildings</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Every property under the platform: caretaker contacts, unit and meter counts, and rent
            model. Open a building to see houses or units and linked tenants.
          </p>
        </div>
        <div className="relative w-full md:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search buildings…"
            className="h-11 rounded-full pl-10"
            aria-label="Search buildings"
          />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((b) => (
          <Link
            key={b.id}
            href={`/dashboard/buildings/${b.id}`}
            className={cn(
              "group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all",
              "hover:border-[#0A4266]/40 hover:shadow-md dark:border-border/80 dark:hover:border-[#6BB4E8]/40"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15">
                  <Building2 className="size-5 text-[#0A4266] dark:text-[#6BB4E8]" />
                </div>
                <div>
                  <p className="font-semibold leading-tight text-foreground group-hover:text-[#0A4266] dark:group-hover:text-[#6BB4E8]">
                    {b.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{b.id}</p>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {b.addressLine}, {b.city}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground dark:bg-muted/80">
                {b.houseCount} houses
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 font-medium text-foreground dark:bg-muted/80">
                {b.meterCount} meters
              </span>
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium",
                  b.rentModel === "per_unit"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                )}
              >
                {b.rentModel === "per_unit" ? "Per unit rent" : "Whole building"}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium text-[#0A4266] dark:text-[#6BB4E8]">
              {rentSummary(b)}
            </p>
            <div className="mt-4 border-t border-border pt-4 dark:border-border/80">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Landlord
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">{b.landlordCompany}</p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <UserRound className="size-3.5" />
                {b.caretakerName} · {b.caretakerPhone}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center dark:border-border/80">
          <p className="text-muted-foreground">No buildings match your search.</p>
          <Button type="button" variant="ghost" className="mt-2" onClick={() => setQ("")}>
            Clear search
          </Button>
        </div>
      )}

      <div className="flex justify-center border-t border-border pt-8 dark:border-border/80">
        <Link
          href="/dashboard/landlords/new"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 rounded-full border-[#0A4266]/40 px-6 dark:border-[#6BB4E8]/50"
          )}
        >
          Add landlord & buildings
        </Link>
      </div>
    </div>
  );
}
