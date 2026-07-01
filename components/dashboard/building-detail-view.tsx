"use client";

import {
  ArrowLeft,
  Building2,
  Droplets,
  Home,
  Layers,
  MapPin,
  Pencil,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildingEditDialog } from "@/components/dashboard/building-edit-dialog";
import { HouseDialog } from "@/components/dashboard/house-dialog";
import { LandlordAddHouseModal } from "@/components/landlord/landlord-add-house-modal";
import { LandlordCaretakerModal } from "@/components/landlord/landlord-caretaker-modal";
import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getBuildingById,
  getBuildingListDisplay,
  getHousesForBuilding,
  loadBuildingDetailFromSupabase,
  rentSummary,
  type BuildingDetailDbBundle,
  type BuildingListRow,
  type HouseUnitRow,
} from "@/lib/buildings-data";
import {
  getLandlordBuildingMerged,
  getLandlordTenantsMerged,
  getMergedHousesForBuildingWithTenantAssignments,
  readStore,
} from "@/lib/landlord-portfolio-storage";
import { unitTypeLabel } from "@/lib/units/labels";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

function formatBuildingAddress(b: BuildingListRow): string {
  const parts = [b.addressLine?.trim(), b.city?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

type DetailState =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      source: "database";
      building: BuildingListRow;
      landlordCompany: string;
      houses: HouseUnitRow[];
      buildingCode: string | null;
    }
  | {
      status: "ready";
      source: "local";
      building: BuildingListRow;
      landlordCompany: string;
      houses: HouseUnitRow[];
    };

export type BuildingDetailViewProps = {
  buildingId: string;
  /** Landlord portal: resolve building from merged localStorage + mock seed. */
  portal?: "admin" | "landlord";
  landlordPortalId?: string;
  /** Server-prefetched Supabase bundle — avoids loading flash on first paint. */
  initialDetail?: BuildingDetailDbBundle | null;
};

function detailFromBundle(bundle: BuildingDetailDbBundle): DetailState {
  return {
    status: "ready",
    source: "database",
    building: bundle.building,
    landlordCompany: bundle.landlordCompany,
    houses: bundle.houses,
    buildingCode: bundle.buildingCode,
  };
}

export function BuildingDetailView({
  buildingId,
  portal = "admin",
  landlordPortalId,
  initialDetail,
}: BuildingDetailViewProps) {
  const pathname = usePathname();
  const portfolio = useLandlordPortfolioStore();
  const [detail, setDetail] = useState<DetailState>(() =>
    initialDetail ? detailFromBundle(initialDetail) : { status: "loading" },
  );
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const isRetry = reloadKey > 0;
    if (isRetry) {
      setDetail({ status: "loading" });
    }

    async function resolve() {
      try {
      const supabase = tryGetSupabaseBrowserClient();
      if (supabase) {
        const bundle = await loadBuildingDetailFromSupabase(supabase, {
          buildingId,
          landlordId: portal === "landlord" ? landlordPortalId : null,
        });
        if (cancelled) return;
        if (bundle) {
          setDetail({
            status: "ready",
            source: "database",
            building: bundle.building,
            landlordCompany: bundle.landlordCompany,
            houses: bundle.houses,
            buildingCode: bundle.buildingCode,
          });
          return;
        }
      }

      const mockB = getBuildingById(buildingId);
      if (mockB) {
        if (cancelled) return;
        const d = getBuildingListDisplay(mockB);
        setDetail({
          status: "ready",
          source: "local",
          building: mockB,
          landlordCompany: d.landlordCompany,
          houses: getHousesForBuilding(mockB),
        });
        return;
      }

      if (portal === "landlord" && landlordPortalId) {
        const store = readStore();
        const lb = getLandlordBuildingMerged(landlordPortalId, buildingId, store);
        if (lb) {
          if (cancelled) return;
          const tenants = getLandlordTenantsMerged(landlordPortalId, store);
          const houses = getMergedHousesForBuildingWithTenantAssignments(
            lb,
            store,
            tenants,
          );
          const d = getBuildingListDisplay(lb);
          setDetail({
            status: "ready",
            source: "local",
            building: lb,
            landlordCompany: d.landlordCompany,
            houses,
          });
          return;
        }
      }

      if (!cancelled) {
        setDetail({ status: "notfound" });
      }
      } catch (e) {
        if (!cancelled) {
          setDetail({
            status: "error",
            message:
              e instanceof Error ? e.message : "Could not load this building.",
          });
        }
      }
    }

    void resolve();
    return () => {
      cancelled = true;
    };
  }, [buildingId, portal, landlordPortalId, pathname, portfolio, reloadKey]);

  const [unitQuery, setUnitQuery] = useState("");
  const [caretakerOpen, setCaretakerOpen] = useState(false);
  const [addHouseOpen, setAddHouseOpen] = useState(false);
  const [editBuildingOpen, setEditBuildingOpen] = useState(false);
  const [houseDialogOpen, setHouseDialogOpen] = useState(false);
  const [editingHouse, setEditingHouse] = useState<HouseUnitRow | null>(null);
  const reloadDetail = () => setReloadKey((k) => k + 1);

  const building = detail.status === "ready" ? detail.building : undefined;
  const houses = detail.status === "ready" ? detail.houses : [];
  const display =
    detail.status === "ready"
      ? { landlordCompany: detail.landlordCompany }
      : undefined;
  const isLiveDetail = detail.status === "ready" && detail.source === "database";
  const buildingCode =
    detail.status === "ready" && detail.source === "database"
      ? detail.buildingCode
      : null;

  const filteredHouses = useMemo(() => {
    const s = unitQuery.trim().toLowerCase();
    if (!s) return houses;
    return houses.filter(
      (h) =>
        h.label.toLowerCase().includes(s) ||
        (h.tenantName && h.tenantName.toLowerCase().includes(s)) ||
        (h.meterId && h.meterId.toLowerCase().includes(s)) ||
        (h.description && h.description.toLowerCase().includes(s)),
    );
  }, [houses, unitQuery]);

  function unitRentDisplay(h: HouseUnitRow): string {
    if (h.rentKes != null && h.rentKes > 0) {
      return `${h.rentKes.toLocaleString("en-KE")} KES`;
    }
    if (building && building.rentModel === "per_unit") {
      return `${building.rentKes.toLocaleString("en-KE")} KES`;
    }
    return "—";
  }

  const buildingsListHref =
    portal === "landlord" ? "/landlords/dashboard/buildings" : "/dashboard/buildings";

  if (detail.status === "loading") {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Loading building…</div>
    );
  }

  if (detail.status === "error") {
    return (
      <div className="space-y-6 pb-10">
        <Link
          href={buildingsListHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-4" />
          Back to buildings
        </Link>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-10 text-center dark:border-destructive/40">
          <p className="text-sm text-destructive">{detail.message}</p>
          <Button
            type="button"
            variant="outline"
            className="mt-6 rounded-full"
            onClick={() => {
              setDetail({ status: "loading" });
              setReloadKey((k) => k + 1);
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (detail.status === "notfound" || !building || !display) {
    return (
      <div className="space-y-6 pb-10">
        <Link
          href={buildingsListHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-4" />
          Back to buildings
        </Link>
        <div className="rounded-xl border border-border bg-card p-10 text-center dark:border-border/80">
          <p className="text-muted-foreground">Building not found.</p>
          <Link
            href={buildingsListHref}
            className={cn(buttonVariants({ variant: "default" }), "mt-6 rounded-full")}
          >
            View all buildings
          </Link>
        </div>
      </div>
    );
  }

  const occupied = houses.filter((h) => h.tenantId).length;

  const tenantHrefBase =
    portal === "landlord" ? "/landlords/dashboard/tenants" : "/dashboard/tenants";
  const unitHrefBase =
    portal === "landlord" ? "/landlords/dashboard/units" : "/dashboard/units";

  const showLandlordLocalActions =
    portal === "landlord" && landlordPortalId && !isLiveDetail;

  return (
    <div className="space-y-8 pb-10">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={buildingsListHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 inline-flex gap-1.5 rounded-full px-2 text-muted-foreground hover:text-foreground",
          )}
        >
          <ArrowLeft className="size-4" />
          Back to buildings
        </Link>
        {isLiveDetail && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setEditBuildingOpen(true)}
          >
            <Pencil className="size-3.5" />
            Edit building
          </Button>
        )}
      </div>

      <header className="rounded-2xl border border-border bg-gradient-to-br from-[#0A4266]/5 via-card to-card p-6 dark:border-border/80 dark:from-[#6BB4E8]/10 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-[#0A4266] text-white dark:bg-[#6BB4E8] dark:text-foreground">
                <Building2 className="size-6" />
              </div>
              <div>
                {buildingCode ? (
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {buildingCode}
                  </p>
                ) : isLiveDetail ? null : (
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {building.id}
                  </p>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  {building.name}
                </h1>
              </div>
            </div>
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              {formatBuildingAddress(building)}
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
              {portal === "admin" ? (
                <Link
                  href={`/dashboard/landlords/${building.landlordId}`}
                  className="mt-2 inline-flex text-sm font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                >
                  Open landlord profile
                </Link>
              ) : (
                <Link
                  href="/landlords/dashboard/settings"
                  className="mt-2 inline-flex text-sm font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                >
                  Account settings
                </Link>
              )}
            </div>
            <div className="border-t border-border pt-4 dark:border-border/80">
              <div className="flex items-start justify-between gap-2">
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <UserRound className="size-3.5" />
                  Caretaker / manager
                </p>
                {showLandlordLocalActions && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 rounded-full px-2.5 text-xs"
                    onClick={() => setCaretakerOpen(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
              <p className="mt-1 font-medium text-foreground">{building.caretakerName || "—"}</p>
              <p className="text-sm text-muted-foreground">{building.caretakerPhone || "—"}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-[#0A4266] dark:text-[#6BB4E8]" />
            <h2 className="text-lg font-semibold text-foreground">Houses & units</h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            {showLandlordLocalActions && (
              <Button
                type="button"
                className="rounded-full gap-2 bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                onClick={() => setAddHouseOpen(true)}
              >
                <Home className="size-4" />
                Add house / unit
              </Button>
            )}
            {isLiveDetail && (
              <Button
                type="button"
                className="rounded-full gap-2 bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                onClick={() => {
                  setEditingHouse(null);
                  setHouseDialogOpen(true);
                }}
              >
                <Home className="size-4" />
                Add house
              </Button>
            )}
            <Input
              value={unitQuery}
              onChange={(e) => setUnitQuery(e.target.value)}
              placeholder="Filter by unit, tenant, or meter…"
              className="h-10 min-w-0 flex-1 rounded-full sm:max-w-md"
              aria-label="Filter units"
            />
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border dark:border-border/80">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:border-border/80">
              <tr>
                <th className="px-4 py-3">Unit</th>
                <th className="hidden px-4 py-3 sm:table-cell">Type</th>
                <th className="px-4 py-3">Rent / mo</th>
                <th className="hidden px-4 py-3 md:table-cell">Tenant</th>
                <th className="hidden px-4 py-3 lg:table-cell">Meter (STS)</th>
                <th className="px-4 py-3">Notes</th>
                {isLiveDetail && <th className="px-4 py-3 text-right">Edit</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border dark:divide-border/80">
              {filteredHouses.map((h) => (
                <tr
                  key={h.id}
                  className="bg-card transition-colors hover:bg-muted/30 dark:hover:bg-muted/15"
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {isLiveDetail ? (
                      <Link
                        href={`${unitHrefBase}/${encodeURIComponent(h.id)}`}
                        className="text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                      >
                        {h.label}
                      </Link>
                    ) : (
                      h.label
                    )}
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {unitTypeLabel(h.unitType)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-foreground">
                    {unitRentDisplay(h)}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    {h.tenantId && h.tenantName ? (
                      <Link
                        href={`${tenantHrefBase}/${encodeURIComponent(h.tenantId)}`}
                        className="font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                      >
                        {h.tenantName}
                      </Link>
                    ) : portal === "landlord" ? (
                      <Link
                        href={`/landlords/dashboard/tenants/new?buildingId=${encodeURIComponent(buildingId)}&unitId=${encodeURIComponent(h.id)}`}
                        className="font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]"
                      >
                        Add tenant
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
                  {isLiveDetail && (
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${h.label}`}
                        onClick={() => {
                          setEditingHouse(h);
                          setHouseDialogOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredHouses.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {houses.length === 0
              ? "No units are recorded for this building yet."
              : "No units match your filter."}
          </p>
        )}
      </section>

      {showLandlordLocalActions && (
        <>
          <LandlordCaretakerModal
            open={caretakerOpen}
            onClose={() => setCaretakerOpen(false)}
            building={building}
            landlordId={landlordPortalId!}
          />
          <LandlordAddHouseModal
            open={addHouseOpen}
            onClose={() => setAddHouseOpen(false)}
            building={building}
            landlordId={landlordPortalId!}
          />
        </>
      )}

      {isLiveDetail && (
        <>
          <BuildingEditDialog
            open={editBuildingOpen}
            onClose={() => setEditBuildingOpen(false)}
            buildingId={buildingId}
            onSaved={reloadDetail}
          />
          <HouseDialog
            open={houseDialogOpen}
            onClose={() => setHouseDialogOpen(false)}
            buildingId={buildingId}
            house={editingHouse}
            defaultRent={building.rentModel === "per_unit" ? building.rentKes : undefined}
            onSaved={reloadDetail}
          />
        </>
      )}
    </div>
  );
}
