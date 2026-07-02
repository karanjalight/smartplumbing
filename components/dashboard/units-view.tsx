"use client";

import {
  Building2,
  ChevronRight,
  DoorClosed,
  DoorOpen,
  LayoutGrid,
  List,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { formatKes } from "@/lib/billing/money";
import type { AdminUnitListRow } from "@/lib/supabase/queries";
import type { UnitType } from "@/lib/supabase/types";
import {
  UNIT_CATEGORY_LABEL,
  UNIT_TYPE_CATEGORY,
  UNIT_TYPE_LABEL,
  UNIT_TYPE_ORDER,
  unitTypeCategory,
  unitTypeLabel,
} from "@/lib/units/labels";
import { cn } from "@/lib/utils";

const SELECT_CLASS =
  "h-10 rounded-lg border border-input bg-transparent px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

type TypeFilter = "all" | UnitType;
type StatusFilter = "all" | "occupied" | "vacant";

function TypeBadge({ type }: { type: UnitType | null }) {
  const category = unitTypeCategory(type);
  const className =
    category === "residential"
      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
      : category === "commercial"
        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {unitTypeLabel(type)}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function UnitsTable({ rows }: { rows: AdminUnitListRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-5 py-3">Unit</th>
            <th className="px-5 py-3">Type</th>
            <th className="px-5 py-3">Building</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Rent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.id}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50"
            >
              <td className="px-5 py-3.5">
                <Link
                  href={`/dashboard/units/${encodeURIComponent(u.id)}`}
                  className="group inline-flex items-center gap-1 font-medium text-[#0A4266] hover:underline dark:text-[#6BB4E8]"
                >
                  {u.label}
                  <ChevronRight
                    className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden
                  />
                </Link>
                {u.code ? (
                  <p className="text-xs text-muted-foreground">{u.code}</p>
                ) : null}
              </td>
              <td className="px-5 py-3.5">
                <TypeBadge type={u.unitType} />
              </td>
              <td className="px-5 py-3.5">
                <Link
                  href={`/dashboard/buildings/${encodeURIComponent(u.buildingId)}`}
                  className="inline-flex items-center gap-1.5 text-foreground hover:text-[#0A4266] hover:underline dark:hover:text-[#6BB4E8]"
                >
                  <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
                  {u.buildingName}
                </Link>
              </td>
              <td className="px-5 py-3.5">
                {u.occupied ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <DoorClosed className="size-3.5" aria-hidden />
                    <span className="font-medium">Occupied</span>
                    {u.occupantName ? (
                      <span className="text-muted-foreground">· {u.occupantName}</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <DoorOpen className="size-3.5" aria-hidden />
                    Vacant
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5 tabular-nums text-foreground">
                {u.effectiveRentKes != null ? (
                  <>
                    {formatKes(u.effectiveRentKes)}
                    {u.rentKes == null ? (
                      <span className="ml-1 text-xs text-muted-foreground">
                        (building default)
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UnitsView({ rows }: { rows: AdminUnitListRow[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [groupByType, setGroupByType] = useState(false);

  // Distinct buildings present in the data, for the building filter.
  const buildings = useMemo(() => {
    const byId = new Map<string, string>();
    for (const u of rows) {
      if (!byId.has(u.buildingId)) byId.set(u.buildingId, u.buildingName);
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((u) => {
      if (typeFilter !== "all" && u.unitType !== typeFilter) return false;
      if (buildingFilter !== "all" && u.buildingId !== buildingFilter) return false;
      if (statusFilter === "occupied" && !u.occupied) return false;
      if (statusFilter === "vacant" && u.occupied) return false;
      if (!q) return true;
      return (
        u.label.toLowerCase().includes(q) ||
        (u.code?.toLowerCase().includes(q) ?? false) ||
        u.buildingName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, typeFilter, statusFilter, buildingFilter]);

  const totals = useMemo(() => {
    const occupied = rows.filter((u) => u.occupied).length;
    return { total: rows.length, occupied, vacant: rows.length - occupied };
  }, [rows]);

  const groups = useMemo(() => {
    if (!groupByType) return [];
    const byType = new Map<UnitType | "none", AdminUnitListRow[]>();
    for (const u of filtered) {
      const key = u.unitType ?? "none";
      const arr = byType.get(key) ?? [];
      arr.push(u);
      byType.set(key, arr);
    }
    const ordered: { key: UnitType | "none"; label: string; rows: AdminUnitListRow[] }[] = [];
    for (const t of UNIT_TYPE_ORDER) {
      const g = byType.get(t);
      if (g && g.length) ordered.push({ key: t, label: UNIT_TYPE_LABEL[t], rows: g });
    }
    const none = byType.get("none");
    if (none && none.length) {
      ordered.push({ key: "none", label: "Unspecified", rows: none });
    }
    return ordered;
  }, [filtered, groupByType]);

  const toggleClass = (active: boolean) =>
    cn(
      buttonVariants({ variant: active ? "default" : "outline", size: "sm" }),
      "gap-1.5 rounded-full",
      active && "bg-[#0A4266] text-white hover:bg-[#0A4266]/90"
    );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Units</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every unit across the portfolio — filter or group by type, building and
          status.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={LayoutGrid} label="Total units" value={totals.total} />
        <StatCard icon={DoorClosed} label="Occupied" value={totals.occupied} />
        <StatCard icon={DoorOpen} label="Vacant" value={totals.vacant} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search unit, code or building…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-lg pl-9"
            aria-label="Search units"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="building-filter">
            Filter by building
          </label>
          <select
            id="building-filter"
            className={SELECT_CLASS}
            value={buildingFilter}
            onChange={(e) => setBuildingFilter(e.target.value)}
          >
            <option value="all">All buildings</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="type-filter">
            Filter by type
          </label>
          <select
            id="type-filter"
            className={SELECT_CLASS}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
          >
            <option value="all">All types</option>
            <optgroup label={UNIT_CATEGORY_LABEL.residential}>
              {UNIT_TYPE_ORDER.filter(
                (t) => UNIT_TYPE_CATEGORY[t] === "residential"
              ).map((t) => (
                <option key={t} value={t}>
                  {UNIT_TYPE_LABEL[t]}
                </option>
              ))}
            </optgroup>
            <optgroup label={UNIT_CATEGORY_LABEL.commercial}>
              {UNIT_TYPE_ORDER.filter(
                (t) => UNIT_TYPE_CATEGORY[t] === "commercial"
              ).map((t) => (
                <option key={t} value={t}>
                  {UNIT_TYPE_LABEL[t]}
                </option>
              ))}
            </optgroup>
          </select>

          <label className="sr-only" htmlFor="status-filter">
            Filter by status
          </label>
          <select
            id="status-filter"
            className={SELECT_CLASS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            <option value="all">All statuses</option>
            <option value="occupied">Occupied</option>
            <option value="vacant">Vacant</option>
          </select>

          <button
            type="button"
            className={toggleClass(groupByType)}
            onClick={() => setGroupByType((v) => !v)}
            aria-pressed={groupByType}
          >
            <List className="size-4" aria-hidden />
            Group by type
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center dark:border-border/80">
          <div className="flex size-12 items-center justify-center rounded-full bg-[#0A4266]/10 text-[#0A4266] dark:bg-[#6BB4E8]/20 dark:text-[#6BB4E8]">
            <LayoutGrid className="size-6" aria-hidden />
          </div>
          <div>
            <p className="font-medium text-foreground">
              {rows.length === 0 ? "No units yet" : "No units match these filters"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {rows.length === 0
                ? "Units appear here once buildings have houses."
                : "Try clearing the search or filters."}
            </p>
          </div>
          {rows.length === 0 ? (
            <Link
              href="/dashboard/buildings"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
            >
              <Building2 className="size-4" aria-hidden />
              Go to Buildings
            </Link>
          ) : null}
        </div>
      ) : groupByType ? (
        <div className="space-y-6">
          {groups.map((g) => (
            <div
              key={g.key}
              className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-sm font-semibold text-foreground">{g.label}</h2>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {g.rows.length}
                </span>
              </div>
              <UnitsTable rows={g.rows} />
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">All units</h2>
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {rows.length}
            </span>
          </div>
          <UnitsTable rows={filtered} />
        </div>
      )}
    </div>
  );
}
