"use client";

import {
  Building2,
  Calendar,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  deleteTenantRecord,
  updateTenantRecord,
} from "@/app/(dashboard)/dashboard/tenants/actions";
import { TenantStatusBadge } from "@/components/dashboard/tenant-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchBuildingsByLandlordId,
  fetchHousesForBuilding,
  type BuildingListRow,
  type HouseUnitRow,
} from "@/lib/buildings-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  TABLE_PAGE_SIZE_OPTIONS,
  fetchTenantRowsForLandlord,
  formatKes,
  type TenantRow,
  type TenantStatus,
} from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: { key: TenantStatus; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "low_credit", label: "Low credit" },
  { key: "inactive", label: "Inactive" },
  { key: "overdue", label: "Overdue" },
];

function normalizeTenantRow(
  tenant: TenantRow,
  buildings: BuildingListRow[],
): TenantRow {
  let next = { ...tenant };
  if (!next.buildingId && buildings.length) {
    const byName = buildings.find((b) => b.name === next.property);
    if (byName) next = { ...next, buildingId: byName.id };
  }
  return next;
}

function TenantEditorModal({
  onClose,
  landlordId,
  buildings,
  allTenants,
  tenant,
  onSaved,
}: {
  onClose: () => void;
  landlordId: string;
  buildings: BuildingListRow[];
  allTenants: TenantRow[];
  tenant: TenantRow;
  onSaved: () => void;
}) {
  const [row, setRow] = useState<TenantRow>(() =>
    normalizeTenantRow(tenant, buildings)
  );
  const [saving, setSaving] = useState(false);
  const [liveHouses, setLiveHouses] = useState<HouseUnitRow[]>([]);

  useEffect(() => {
    setRow(normalizeTenantRow(tenant, buildings));
  }, [tenant, buildings]);

  const selectedBuilding = useMemo(
    () => buildings.find((b) => b.id === row.buildingId) ?? buildings[0],
    [buildings, row.buildingId]
  );

  useEffect(() => {
    if (!selectedBuilding?.id) {
      setLiveHouses([]);
      return;
    }
    let cancelled = false;
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) return;
    void fetchHousesForBuilding(supabase, selectedBuilding.id).then((houses) => {
      if (!cancelled) setLiveHouses(houses);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedBuilding?.id]);

  const housesForBuilding = useMemo(() => {
    if (!selectedBuilding) return [];
    return liveHouses;
  }, [selectedBuilding, liveHouses]);

  async function save() {
    if (!row.name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!row.property.trim()) {
      toast.error("Property / building is required");
      return;
    }
    if (buildings.length > 0 && !row.houseUnitId?.trim()) {
      toast.error("Select a house / unit in the building");
      return;
    }
    const hid = row.houseUnitId?.trim();
    if (hid) {
      const occupant = allTenants.find(
        (t) => t.houseUnitId === hid && t.id !== row.id
      );
      if (occupant) {
        toast.error(`That unit is already assigned to ${occupant.name}.`);
        return;
      }
    }

    const payload = {
      ...row,
      name: row.name.trim(),
      phone: row.phone.trim(),
      meterId: row.meterId.trim() || "—",
      property: row.property.trim(),
      unit: row.unit.trim() || "—",
      buildingId: row.buildingId ?? null,
      houseUnitId: row.houseUnitId?.trim() || null,
    };

    setSaving(true);
    try {
      const result = await updateTenantRecord({
        tenantId: row.id,
        landlordId,
        fullName: payload.name,
        phone: payload.phone,
        status: payload.status,
        balanceKes: payload.balanceKes,
        buildingId: payload.buildingId ?? undefined,
        unitId: payload.houseUnitId ?? undefined,
        meterNo: payload.meterId !== "—" ? payload.meterId : undefined,
        lastTokenAt: payload.lastTokenDate,
        lastTokenPreview: payload.lastTokenPreview,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tenant updated");
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="tenant-editor-title"
        className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-card p-6 shadow-lg dark:border-border/80"
      >
        <h2 id="tenant-editor-title" className="text-lg font-semibold text-foreground">
          Edit tenant
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pick a building, then the house or unit. The tenant is linked to that unit row (same as on the building detail).
        </p>
        <div className="mt-4 grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="t-name">Full name</Label>
            <Input
              id="t-name"
              value={row.name}
              onChange={(e) => setRow((r) => ({ ...r, name: e.target.value }))}
              className="rounded-full"
              placeholder="e.g. Mary Wanjiku"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-phone">Phone</Label>
            <Input
              id="t-phone"
              value={row.phone}
              onChange={(e) => setRow((r) => ({ ...r, phone: e.target.value }))}
              className="rounded-full"
              placeholder="+254 …"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-meter">Meter ID (STS)</Label>
            <Input
              id="t-meter"
              value={row.meterId}
              onChange={(e) => setRow((r) => ({ ...r, meterId: e.target.value }))}
              className="rounded-full font-mono text-sm"
              placeholder="Numeric meter serial (prefilled from unit when set)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-building">Building</Label>
            {buildings.length > 0 ? (
              <select
                id="t-building"
                value={row.buildingId ?? selectedBuilding?.id ?? ""}
                onChange={(e) => {
                  const bid = e.target.value;
                  const b = buildings.find((x) => x.id === bid);
                  setRow((r) => ({
                    ...r,
                    buildingId: bid,
                    property: b?.name ?? r.property,
                    houseUnitId: null,
                    unit: "",
                  }));
                }}
                className={selectClass}
              >
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="t-building"
                value={row.property}
                onChange={(e) => setRow((r) => ({ ...r, property: e.target.value }))}
                className="rounded-full"
                placeholder="Building name (add a building first)"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-house">House / unit</Label>
            {buildings.length > 0 && selectedBuilding ? (
              housesForBuilding.length > 0 ? (
                <select
                  id="t-house"
                  value={row.houseUnitId ?? ""}
                  onChange={(e) => {
                    const hid = e.target.value;
                    const h = housesForBuilding.find((x) => x.id === hid);
                    setRow((r) => ({
                      ...r,
                      houseUnitId: hid || null,
                      unit: h?.label ?? "",
                      meterId:
                        h?.meterId && (!r.meterId?.trim() || r.meterId === "—")
                          ? h.meterId
                          : r.meterId,
                    }));
                  }}
                  className={selectClass}
                >
                  <option value="">Select unit…</option>
                  {housesForBuilding.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                      {h.meterId ? ` · ${h.meterId}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No units in this building yet. Add units from the building page first.
                </p>
              )
            ) : (
              <Input
                id="t-unit"
                value={row.unit}
                onChange={(e) => setRow((r) => ({ ...r, unit: e.target.value }))}
                className="rounded-full"
                placeholder="e.g. Block A · Unit 12"
              />
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="t-bal">Balance (KES)</Label>
              <Input
                id="t-bal"
                inputMode="numeric"
                value={String(row.balanceKes)}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/[^\d.-]/g, ""));
                  setRow((r) => ({ ...r, balanceKes: Number.isFinite(n) ? n : 0 }));
                }}
                className="rounded-full tabular-nums"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-status">Status</Label>
              <select
                id="t-status"
                value={row.status}
                onChange={(e) =>
                  setRow((r) => ({ ...r, status: e.target.value as TenantStatus }))
                }
                className="flex h-10 w-full rounded-full border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:border-border/80"
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-ltd">Last token date</Label>
            <Input
              id="t-ltd"
              value={row.lastTokenDate}
              onChange={(e) => setRow((r) => ({ ...r, lastTokenDate: e.target.value }))}
              className="rounded-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-lpv">Last token preview</Label>
            <Input
              id="t-lpv"
              value={row.lastTokenPreview}
              onChange={(e) => setRow((r) => ({ ...r, lastTokenPreview: e.target.value }))}
              className="rounded-full font-mono text-sm"
            />
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={saving}
            className="rounded-full bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            onClick={() => void save()}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}

type TenantListState =
  | { status: "loading" }
  | { status: "live"; rows: TenantRow[] }
  | { status: "error"; message: string };

export function LandlordTenantsView({ landlordId }: { landlordId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | TenantStatus>("all");
  const [buildingCategory, setBuildingCategory] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const [tenantList, setTenantList] = useState<TenantListState>({ status: "loading" });
  const [liveBuildings, setLiveBuildings] = useState<BuildingListRow[]>([]);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadTenants = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setTenantList({
        status: "error",
        message: "Supabase is not configured.",
      });
      return;
    }
    try {
      const rows = await fetchTenantRowsForLandlord(supabase, landlordId);
      setTenantList({ status: "live", rows });
    } catch (e) {
      setTenantList({
        status: "error",
        message:
          e instanceof Error ? e.message : "Could not load tenants.",
      });
    }
  }, [landlordId]);

  useEffect(() => {
    void loadTenants();
  }, [loadTenants, pathname]);

  useEffect(() => {
    if (tenantList.status !== "live") {
      setLiveBuildings([]);
      return;
    }
    let cancelled = false;
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) return;
    void fetchBuildingsByLandlordId(supabase, landlordId).then((rows) => {
      if (!cancelled) setLiveBuildings(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [tenantList.status, landlordId]);

  const tenants = useMemo(() => {
    if (tenantList.status === "live") return tenantList.rows;
    return [];
  }, [tenantList]);

  const buildings = liveBuildings;

  async function handleRemoveTenant(row: TenantRow) {
    if (
      typeof window === "undefined" ||
      !window.confirm(`Remove tenant ${row.name} from your list?`)
    ) {
      return;
    }

    setRemovingId(row.id);
    try {
      const result = await deleteTenantRecord({
        tenantId: row.id,
        landlordId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Tenant removed");
      await loadTenants();
      router.refresh();
    } finally {
      setRemovingId(null);
    }
  }

  useEffect(() => {
    if (!highlightId || !highlightRef.current) return;
    highlightRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [highlightId, tenants]);

  const summary = useMemo(() => {
    const activeMeters = tenants.filter((t) => t.status === "active").length;
    const lowBalance = tenants.filter((t) => t.status === "low_credit").length;
    const pending = tenants.filter(
      (t) => t.status === "overdue" || t.balanceKes === 0
    ).length;
    return { total: tenants.length, activeMeters, lowBalance, pending };
  }, [tenants]);

  const matchesSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.meterId.toLowerCase().includes(q) ||
        t.property.toLowerCase().includes(q) ||
        t.unit.toLowerCase().includes(q) ||
        t.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        t.id.toLowerCase().includes(q)
      );
    });
  }, [tenants, search, filter]);

  const buildingCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of matchesSearch) {
      map.set(t.property, (map.get(t.property) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [matchesSearch]);

  const filtered = useMemo(() => {
    if (buildingCategory === "all") return matchesSearch;
    return matchesSearch.filter((t) => t.property === buildingCategory);
  }, [matchesSearch, buildingCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  if (tenantList.status === "loading") {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-muted-foreground">
        Loading tenants…
      </div>
    );
  }

  if (tenantList.status === "error") {
    return (
      <div className="space-y-4 py-12 text-center text-sm text-destructive">
        {tenantList.message}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenants assigned to units in your buildings. Only real records from your account are shown.
          </p>
        </div>
        <Link
          href="/landlords/dashboard/tenants/new"
          className={cn(
            buttonVariants({ variant: "default" }),
            "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          )}
        >
          <Plus className="size-4" aria-hidden />
          Add tenant
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">Active</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.activeMeters}</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">Low credit</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.lowBalance}</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">Overdue / zero bal.</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.pending}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4 shrink-0" aria-hidden />
          <span>Buildings</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBuildingCategory("all");
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              buildingCategory === "all"
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-muted/40 text-foreground hover:bg-muted dark:border-border/80"
            )}
          >
            All ({matchesSearch.length})
          </button>
          {buildingCategories.map(({ name, count }) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setBuildingCategory(name);
                setPage(1);
              }}
              className={cn(
                "max-w-full flex rounded-full border px-3 py-2 text-sm font-medium transition-colors",
                buildingCategory === name
                  ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                  : "border-border bg-card text-foreground hover:bg-muted dark:border-border/80"
              )}
            >
              <span className="line-clamp-1">{name}</span>
              <span className="ml-1.5 tabular-nums opacity-80">({count})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search name, meter, unit, phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-border pl-9 dark:border-border/80"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status</span>
          <select
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value as typeof filter);
              setPage(1);
            }}
            className="h-10 rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
          >
            <option value="all">All</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">ID</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Meter</th>
                <th className="px-4 py-3 font-semibold">Property / unit</th>
                <th className="px-4 py-3 font-semibold">Balance</th>
                <th className="px-4 py-3 font-semibold">Last token</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No tenants match. Add a tenant or adjust filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={row.id}
                    ref={(el) => {
                      if (row.id === highlightId) {
                        highlightRef.current = el;
                      }
                    }}
                    className={cn(
                      "bg-card transition-colors hover:bg-muted/40",
                      row.id === highlightId && "ring-2 ring-inset ring-[#0A4266] dark:ring-[#6BB4E8]"
                    )}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {row.code ?? row.id}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.name}</div>
                      <div className="text-xs text-muted-foreground">{row.phone}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-foreground">{row.meterId}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{row.property}</div>
                      <div className="text-xs text-muted-foreground">{row.unit}</div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {formatKes(row.balanceKes)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Calendar className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div>
                          <div>{row.lastTokenDate}</div>
                          <div className="max-w-[180px] truncate font-mono text-xs text-muted-foreground">
                            {row.lastTokenPreview}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TenantStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/landlords/dashboard/tenants/${row.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "icon-sm" }),
                            "rounded-full"
                          )}
                          aria-label={`View ${row.name}`}
                        >
                          <Eye className="size-4" />
                        </Link>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full"
                          aria-label={`Edit ${row.name}`}
                          onClick={() => {
                            setEditing(row);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          className="rounded-full text-destructive hover:text-destructive"
                          aria-label={`Remove ${row.name}`}
                          disabled={removingId === row.id}
                          onClick={() => void handleRemoveTenant(row)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
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

      {editing && (
        <TenantEditorModal
          onClose={() => setEditing(null)}
          landlordId={landlordId}
          buildings={buildings}
          allTenants={tenants}
          tenant={editing}
          onSaved={() => void loadTenants()}
        />
      )}
    </div>
  );
}
