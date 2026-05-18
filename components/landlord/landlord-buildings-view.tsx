"use client";

import {
  Building2,
  ChevronRight,
  LayoutGrid,
  Layers,
  List,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultBuildingForLandlord,
  deleteLandlordBuilding,
  getLandlordBuildingsMerged,
  readStore,
  upsertLandlordBuilding,
  type RentModel,
} from "@/lib/landlord-portfolio-storage";
import {
  DbBuildingRow,
  getBuildingListDisplay,
  mapDbBuildingToListRow,
  monthlyRentTotalKes,
  rentSummary,
  type BuildingListRow,
} from "@/lib/buildings-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

function BuildingEditorModal({
  open,
  onClose,
  landlordId,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  landlordId: string;
  initial: BuildingListRow | null;
}) {
  const [row, setRow] = useState<BuildingListRow>(() => initial ?? defaultBuildingForLandlord(landlordId));

  useEffect(() => {
    if (open) {
      setRow(initial ?? defaultBuildingForLandlord(landlordId));
    }
  }, [open, initial, landlordId]);

  if (!open) return null;

  function save() {
    if (!row.name.trim()) {
      toast.error("Building name is required");
      return;
    }
    upsertLandlordBuilding({
      ...row,
      name: row.name.trim(),
      addressLine: row.addressLine.trim(),
      city: row.city.trim(),
      caretakerName: row.caretakerName.trim(),
      caretakerPhone: row.caretakerPhone.trim(),
      houseCount: Math.max(1, Math.round(row.houseCount)),
      meterCount: Math.max(0, Math.round(row.meterCount)),
      rentKes: Math.max(0, Math.round(row.rentKes)),
    });
    toast.success(initial ? "Building updated" : "Building added");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="building-editor-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <h2 id="building-editor-title" className="text-lg font-semibold text-foreground">
          {initial ? "Edit building" : "Add building"}
        </h2>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="b-name">Building name</Label>
            <Input
              id="b-name"
              value={row.name}
              onChange={(e) => setRow((r) => ({ ...r, name: e.target.value }))}
              className="rounded-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-addr">Address</Label>
            <Input
              id="b-addr"
              value={row.addressLine}
              onChange={(e) => setRow((r) => ({ ...r, addressLine: e.target.value }))}
              className="rounded-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-city">City / county</Label>
            <Input
              id="b-city"
              value={row.city}
              onChange={(e) => setRow((r) => ({ ...r, city: e.target.value }))}
              className="rounded-full"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-care">Caretaker name</Label>
              <Input
                id="b-care"
                value={row.caretakerName}
                onChange={(e) => setRow((r) => ({ ...r, caretakerName: e.target.value }))}
                className="rounded-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-phone">Caretaker phone</Label>
              <Input
                id="b-phone"
                value={row.caretakerPhone}
                onChange={(e) => setRow((r) => ({ ...r, caretakerPhone: e.target.value }))}
                className="rounded-full"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-houses">Units / houses</Label>
              <Input
                id="b-houses"
                inputMode="numeric"
                value={String(row.houseCount)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setRow((r) => ({ ...r, houseCount: Number.isFinite(n) ? n : 1 }));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-meters">Meters</Label>
              <Input
                id="b-meters"
                inputMode="numeric"
                value={String(row.meterCount)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ""));
                  setRow((r) => ({ ...r, meterCount: Number.isFinite(n) ? n : 0 }));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="b-model">Rent model</Label>
              <select
                id="b-model"
                value={row.rentModel}
                onChange={(e) =>
                  setRow((r) => ({ ...r, rentModel: e.target.value as RentModel }))
                }
                className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
              >
                <option value="per_unit">Per unit</option>
                <option value="whole_building">Whole building</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-rent">Rent (KES)</Label>
              <Input
                id="b-rent"
                inputMode="numeric"
                value={String(row.rentKes)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/[^\d]/g, ""));
                  setRow((r) => ({ ...r, rentKes: Number.isFinite(n) ? n : 0 }));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={save}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function LandlordBuildingsCards({
  buildings,
  isLiveList,
  onEdit,
}: {
  buildings: LandlordBuildingRow[];
  isLiveList: boolean;
  onEdit: (b: BuildingListRow) => void;
}) {
  if (buildings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border py-16 text-center dark:border-border/80">
        <p className="text-muted-foreground">No buildings match. Add your first property.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {buildings.map((b) => (
        <div
          key={b.id}
          className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm dark:border-border/80"
        >
          <Link
            href={`/landlords/dashboard/buildings/${encodeURIComponent(b.id)}`}
            className={cn(
              "group flex flex-col rounded-xl outline-none transition-all",
              "hover:opacity-[0.98] focus-visible:ring-2 focus-visible:ring-[#0A4266]/30 dark:focus-visible:ring-[#6BB4E8]/30",
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
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    KES {monthlyRentTotalKes(b).toLocaleString("en-KE")} / mo potential
                  </p>
                </div>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {b.addressLine?.trim() || "—"}
                {b.city?.trim() ? `, ${b.city.trim()}` : ""}
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
          {!isLiveList && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4 dark:border-border/80">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                aria-label={`Edit ${b.name}`}
                onClick={() => onEdit(b)}
              >
                <Pencil className="mr-1 size-3.5" />
                Edit
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full text-destructive hover:text-destructive"
                aria-label={`Delete ${b.name}`}
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    window.confirm(`Remove building “${b.name}” from your list?`)
                  ) {
                    deleteLandlordBuilding(b.id);
                    toast.success("Building removed");
                  }
                }}
              >
                <Trash2 className="mr-1 size-3.5" />
                Remove
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

type LandlordBuildingRow = BuildingListRow & { landlordCompany: string };

export function LandlordBuildingsView({ landlordId }: { landlordId: string }) {
  const pathname = usePathname();
  const store = useLandlordPortfolioStore();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<BuildingListRow | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem("landlordBuildingsViewMode");
    if (raw === "cards" || raw === "list") {
      setViewMode(raw);
    }
  }, []);

  type BuildingListState =
    | { status: "loading" }
    | { status: "demo" }
    | { status: "live"; rows: LandlordBuildingRow[] }
    | { status: "error"; message: string };

  const [buildingList, setBuildingList] = useState<BuildingListState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setBuildingList({ status: "demo" });
      return;
    }
    (async () => {
      try {
        const { data: lh } = await supabase
          .from("landlords")
          .select("company, full_name")
          .eq("id", landlordId)
          .maybeSingle();
        const { data: buildings, error: bErr } = await supabase
          .from("buildings")
          .select("*")
          .eq("landlord_id", landlordId)
          .order("created_at", { ascending: false });
        if (cancelled) return;
        if (bErr) {
          setBuildingList({ status: "demo" });
          return;
        }
        setBuildingList({
          status: "live",
          rows: (buildings ?? []).map((b) =>
            mapDbBuildingToListRow(b as DbBuildingRow, lh),
          ),
        });
      } catch (e) {
        if (cancelled) return;
        setBuildingList({
          status: "error",
          message:
            e instanceof Error ? e.message : "Could not load buildings.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [landlordId, pathname, reloadKey]);

  const rows = useMemo((): LandlordBuildingRow[] => {
    if (
      buildingList.status === "loading" ||
      buildingList.status === "error"
    ) {
      return [];
    }
    if (buildingList.status === "live") return buildingList.rows;
    const portfolio = store ?? readStore();
    return getLandlordBuildingsMerged(landlordId, portfolio).map((b) =>
      getBuildingListDisplay(b),
    );
  }, [buildingList, store, landlordId]);

  const isLiveList = buildingList.status === "live";

  function persistViewMode(next: "list" | "cards") {
    setViewMode(next);
    try {
      localStorage.setItem("landlordBuildingsViewMode", next);
    } catch {
      /* ignore */
    }
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.city.toLowerCase().includes(s) ||
        r.addressLine.toLowerCase().includes(s) ||
        r.caretakerName.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  if (buildingList.status === "loading") {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Loading buildings…</div>
    );
  }

  if (buildingList.status === "error") {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-destructive">{buildingList.message}</p>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            setBuildingList({ status: "loading" });
            setReloadKey((k) => k + 1);
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between dark:border-border/80">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
            <Layers className="size-8" />
            <h1 className="text-2xl font-bold tracking-tight">Buildings</h1>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {isLiveList
              ? "Properties linked to your account. Total is potential monthly rent (KES) from your rent model and unit count."
              : "Manage properties in your portfolio. With Supabase configured, new buildings are saved to your account and appear in this list."}
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
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
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search…"
              className="h-10 rounded-full pl-9"
              aria-label="Search buildings"
            />
          </div>
          <Link
            href="/landlords/dashboard/buildings/new"
            className={cn(
              buttonVariants({ variant: "default" }),
              "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]",
            )}
          >
            <Plus className="size-4" aria-hidden />
            New building
          </Link>
        </div>
      </header>

      {viewMode === "cards" ? (
        <LandlordBuildingsCards
          buildings={filtered as LandlordBuildingRow[]}
          isLiveList={isLiveList}
          onEdit={(b) => {
            setEditing(b);
            setEditorOpen(true);
          }}
        />
      ) : null}

      {viewMode === "list" ? (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Building</th>
                <th className="px-4 py-3 font-semibold">Location</th>
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
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No buildings match. Add your first property.
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
                    <td className="max-w-[220px] px-4 py-3">
                      <span className="flex items-start gap-1 text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {b.addressLine}, {b.city}
                        </span>
                      </span>
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
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/landlords/dashboard/buildings/${encodeURIComponent(b.id)}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-8 rounded-full px-3 text-xs"
                          )}
                        >
                          Open
                        </Link>
                        {!isLiveList && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="rounded-full"
                              aria-label={`Edit ${b.name}`}
                              onClick={() => {
                                setEditing(b);
                                setEditorOpen(true);
                              }}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              className="rounded-full text-destructive hover:text-destructive"
                              aria-label={`Delete ${b.name}`}
                              onClick={() => {
                                if (
                                  typeof window !== "undefined" &&
                                  window.confirm(`Remove building “${b.name}” from your list?`)
                                ) {
                                  deleteLandlordBuilding(b.id);
                                  toast.success("Building removed");
                                }
                              }}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
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
      ) : null}

      <BuildingEditorModal
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        landlordId={landlordId}
        initial={editing}
      />
    </div>
  );
}
