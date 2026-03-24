"use client";

import {
  ArrowLeft,
  Building2,
  Droplets,
  Layers,
  MapPin,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBuildingById,
  getBuildingListDisplay,
  getHousesForBuilding,
  rentSummary,
} from "@/lib/buildings-data";
import { cn } from "@/lib/utils";

export function BuildingDetailView({ buildingId }: { buildingId: string }) {
  const building = useMemo(() => getBuildingById(buildingId), [buildingId]);
  const [unitQuery, setUnitQuery] = useState("");

  const display = building ? getBuildingListDisplay(building) : undefined;
  const houses = useMemo(
    () => (building ? getHousesForBuilding(building) : []),
    [building]
  );

  const filteredHouses = useMemo(() => {
    const s = unitQuery.trim().toLowerCase();
    if (!s) return houses;
    return houses.filter(
      (h) =>
        h.label.toLowerCase().includes(s) ||
        (h.tenantName && h.tenantName.toLowerCase().includes(s)) ||
        (h.meterId && h.meterId.toLowerCase().includes(s))
    );
  }, [houses, unitQuery]);

  if (!building || !display) {
    return (
      <div className="space-y-6 pb-10">
        <Link
          href="/dashboard/buildings"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeft className="size-4" />
          Back to buildings
        </Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center dark:border-border/80">
          <p className="text-muted-foreground">Building not found.</p>
          <Link
            href="/dashboard/buildings"
            className={cn(buttonVariants({ variant: "default" }), "mt-6 rounded-full")}
          >
            View all buildings
          </Link>
        </div>
      </div>
    );
  }

  const occupied = houses.filter((h) => h.tenantId).length;

  return (
    <div className="space-y-8 pb-10">
      <Link
        href="/dashboard/buildings"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowLeft className="size-4" />
        Back to buildings
      </Link>

      <header className="rounded-2xl border border-border bg-gradient-to-br from-[#0A4266]/5 via-card to-card p-6 dark:border-border/80 dark:from-[#6BB4E8]/10 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0A4266] text-white dark:bg-[#6BB4E8] dark:text-foreground">
                <Building2 className="size-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {building.id}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {building.name}
                </h1>
              </div>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {building.addressLine}, {building.city}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold shadow-sm dark:bg-background/40">
                {building.houseCount} units
              </span>
              <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold shadow-sm dark:bg-background/40">
                {building.meterCount} meters
              </span>
              <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold shadow-sm dark:bg-background/40">
                {occupied} with tenants
              </span>
            </div>
            <p className="text-base font-semibold text-[#0A4266] dark:text-[#6BB4E8]">
              {rentSummary(building)}
            </p>
          </div>
          <div className="w-full shrink-0 space-y-4 rounded-xl border border-border bg-card/90 p-5 dark:border-border/80 lg:max-w-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Landlord
              </p>
              <p className="mt-1 font-semibold text-foreground">{display.landlordCompany}</p>
              <Link
                href={`/dashboard/landlords/${building.landlordId}`}
                className="mt-2 inline-flex text-sm font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
              >
                Open landlord profile
              </Link>
            </div>
            <div className="border-t border-border pt-4 dark:border-border/80">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <UserRound className="size-3.5" />
                Caretaker / manager
              </p>
              <p className="mt-1 font-medium text-foreground">{building.caretakerName}</p>
              <p className="text-sm text-muted-foreground">{building.caretakerPhone}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-[#0A4266] dark:text-[#6BB4E8]" />
            <h2 className="text-lg font-semibold text-foreground">Houses & units</h2>
          </div>
          <Input
            value={unitQuery}
            onChange={(e) => setUnitQuery(e.target.value)}
            placeholder="Filter by unit, tenant, or meter…"
            className="h-10 max-w-md rounded-full"
            aria-label="Filter units"
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-border dark:border-border/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-border/80">
              <tr>
                <th className="px-4 py-3">Unit</th>
                <th className="hidden px-4 py-3 md:table-cell">Tenant</th>
                <th className="hidden px-4 py-3 lg:table-cell">Meter (STS)</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border/80">
              {filteredHouses.map((h) => (
                <tr
                  key={h.id}
                  className="bg-card transition-colors hover:bg-muted/30 dark:hover:bg-muted/15"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{h.label}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {h.tenantId && h.tenantName ? (
                      <Link
                        href={`/dashboard/tenants/${h.tenantId}`}
                        className="font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                      >
                        {h.tenantName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Vacant</span>
                    )}
                  </td>
                  <td className="hidden px-4 py-3 font-mono text-xs lg:table-cell">
                    {h.meterId ? (
                      <span className="inline-flex items-center gap-1">
                        <Droplets className="size-3.5 text-muted-foreground" />
                        {h.meterId}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground">
                    {h.description ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredHouses.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No units match your filter.
          </p>
        )}
      </section>
    </div>
  );
}
