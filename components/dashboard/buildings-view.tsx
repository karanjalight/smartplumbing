"use client";

import {
  Building2,
  ChevronRight,
  LayoutGrid,
  Layers,
  List,
  MapPin,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { deleteBuilding, previewDeleteBuilding } from "@/app/(dashboard)/dashboard/buildings/actions";
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BuildingListRow, DbBuildingRow } from "@/lib/buildings-data";
import {
  getBuildingListDisplay,
  getBuildings,
  mapDbBuildingToListRow,
  monthlyRentTotalKes,
  rentSummary,
} from "@/lib/buildings-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

type Row = BuildingListRow & { landlordCompany: string };

function AdminBuildingsCards({ buildings }: { buildings: Row[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {buildings.map((b) => (
        <Link
          key={b.id}
          href={`/dashboard/buildings/${encodeURIComponent(b.id)}`}
          className={cn(
            "group flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all",
            "hover:border-[#0A4266]/40 hover:shadow-md dark:border-border/80 dark:hover:border-[#6BB4E8]/40",
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
              {b.addressLine || "—"}
              {b.city ? `, ${b.city}` : ""}
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
                  : "bg-violet-500/10 text-violet-700 dark:text-violet-300",
              )}
            >
              {b.rentModel === "per_unit" ? "Per unit rent" : "Whole building"}
            </span>
          </div>
          <p className="mt-3 text-sm font-medium text-[#0A4266] dark:text-[#6BB4E8]">
            {rentSummary(b)}
          </p>
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">
            Total KES {monthlyRentTotalKes(b).toLocaleString("en-KE")} / mo
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
  );
}

export function BuildingsView() {
  const pathname = usePathname();
  const [rows, setRows] = useState<Row[]>([]);
  const [listSource, setListSource] = useState<"loading" | "mock" | "supabase">(
    "loading",
  );
  const [q, setQ] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "cards">("cards");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  useEffect(() => {
    const raw = localStorage.getItem("adminBuildingsViewMode");
    if (raw === "cards" || raw === "list") {
      setViewMode(raw);
    }
  }, []);

  function persistViewMode(next: "list" | "cards") {
    setViewMode(next);
    try {
      localStorage.setItem("adminBuildingsViewMode", next);
    } catch {
      /* ignore */
    }
  }

  const load = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setRows(getBuildings().map((b) => getBuildingListDisplay(b)));
      setListSource("mock");
      return;
    }

    const { data: buildings, error: bErr } = await supabase
      .from("buildings")
      .select("*")
      .order("created_at", { ascending: false });

    if (bErr) {
      setRows(getBuildings().map((b) => getBuildingListDisplay(b)));
      setListSource("mock");
      return;
    }

    const { data: landlords } = await supabase
      .from("landlords")
      .select("id, company, full_name, code");

    const lm = new Map(
      (landlords ?? []).map((l) => [
        l.id,
        { company: l.company, full_name: l.full_name },
      ]),
    );

    setRows(
      (buildings ?? []).map((b) =>
        mapDbBuildingToListRow(b as DbBuildingRow, lm.get(b.landlord_id) ?? null),
      ),
    );
    setListSource("supabase");
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

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
        r.id.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  return (
    <div className="space-y-8 pb-8">
      <header className="flex flex-col gap-6 border-b border-border pb-6 dark:border-border/80">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
              <Layers className="size-8" />
              <h1 className="text-2xl font-bold tracking-tight">Buildings</h1>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Every property under the platform: caretaker contacts, unit and meter counts, and rent
              model. Open a building to see houses or units and linked tenants.
            </p>
            {listSource === "mock" && (
              <p className="text-xs text-amber-800 dark:text-amber-200/90">
                Showing demo buildings (Supabase unavailable or query failed). Configure{" "}
                <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_*</code> to load live
                data.
              </p>
            )}
          </div>
          <div className="flex flex-row gap-2">
            <div
              className="flex w-full rounded-full border border-border p-0.5 sm:w-auto dark:border-border/80"
              role="group"
              aria-label="View mode"
            >
              <Button
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-9 flex-1 gap-1.5 rounded-full sm:flex-initial",
                  viewMode === "list" &&
                    "bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]",
                )}
                onClick={() => persistViewMode("list")}
              >
                <List className="size-4 shrink-0" aria-hidden />
                List
              </Button>
              <Button
                type="button"
                variant={viewMode === "cards" ? "default" : "ghost"}
                size="sm"
                className={cn(
                  "h-9 flex-1 gap-1.5 rounded-full sm:flex-initial",
                  viewMode === "cards" &&
                    "bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]",
                )}
                onClick={() => persistViewMode("cards")}
              >
                <LayoutGrid className="size-4 shrink-0" aria-hidden />
                Cards
              </Button>
            </div>
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search buildings…"
                className="h-11 rounded-full pl-10"
                aria-label="Search buildings"
              />
            </div>
          </div>
        </div>
      </header>

      {listSource === "loading" && (
        <p className="text-sm text-muted-foreground">Loading buildings…</p>
      )}

      {listSource !== "loading" && filtered.length > 0 && viewMode === "cards" && (
        <AdminBuildingsCards buildings={filtered} />
      )}

      {listSource !== "loading" && filtered.length > 0 && viewMode === "list" && (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead>
                <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                  <th className="px-4 py-3 font-semibold">Building</th>
                  <th className="px-4 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Landlord</th>
                  <th className="px-4 py-3 font-semibold">Caretaker</th>
                  <th className="px-4 py-3 font-semibold">Units</th>
                  <th className="px-4 py-3 font-semibold">Rent</th>
                  <th className="px-4 py-3 font-semibold tabular-nums">Total / mo</th>
                  <th className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      No buildings match your search.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((b) => (
                    <tr key={b.id} className="bg-card transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="flex size-9 items-center justify-center rounded-lg bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15">
                            <Building2 className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" />
                          </span>
                          <span className="font-medium text-foreground">{b.name}</span>
                        </div>
                      </td>
                      <td className="max-w-[200px] px-4 py-3">
                        <span className="flex items-start gap-1 text-muted-foreground">
                          <MapPin className="mt-0.5 size-3.5 shrink-0" />
                          <span>
                            {b.addressLine || "—"}
                            {b.city ? `, ${b.city}` : ""}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">
                        {b.landlordCompany}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium text-foreground">{b.caretakerName}</div>
                        <div className="text-xs text-muted-foreground">{b.caretakerPhone}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-foreground">
                        {b.houseCount} / {b.meterCount} m
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[#0A4266] dark:text-[#6BB4E8]">
                        {rentSummary(b)}
                      </td>
                      <td className="px-4 py-3 tabular-nums text-sm font-semibold text-foreground">
                        KES {monthlyRentTotalKes(b).toLocaleString("en-KE")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/buildings/${encodeURIComponent(b.id)}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "h-8 rounded-full px-3 text-xs",
                            )}
                          >
                            Open
                          </Link>
                          <DeleteRowButton
                            preview={() => previewDeleteBuilding(b.id)}
                            onDelete={() => deleteBuilding(b.id)}
                            title="Delete building?"
                            description={`"${b.name}" and its houses will be permanently deleted.`}
                            successMessage="Building deleted"
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 dark:border-border/80 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {showingFrom}-{showingTo} of {filtered.length}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ‹
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {safePage} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                ›
              </Button>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-full border border-border bg-background px-2 text-sm dark:border-border/80"
              >
                {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {listSource !== "loading" && filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center dark:border-border/80">
          <p className="text-muted-foreground">No buildings match your search.</p>
          <Button type="button" variant="ghost" className="mt-2" onClick={() => setQ("")}>
            Clear search
          </Button>
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-3 border-t border-border pt-8 sm:flex-row dark:border-border/80">
        <Link
          href="/dashboard/buildings/new"
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-11 rounded-full bg-[#0A4266] px-6 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]",
          )}
        >
          New building
        </Link>
        <Link
          href="/dashboard/landlords/new"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-11 rounded-full border-[#0A4266]/40 px-6 dark:border-[#6BB4E8]/50",
          )}
        >
          Add landlord
        </Link>
      </div>
    </div>
  );
}
