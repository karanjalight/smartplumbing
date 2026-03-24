"use client";

import {
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ListFilter,
  MapPin,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { TenantStatusBadge } from "@/components/dashboard/tenant-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MOCK_LANDLORDS,
  MOCK_TENANTS,
  TABLE_PAGE_SIZE_OPTIONS,
  formatKes,
  type TenantStatus,
} from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const FILTER_OPTIONS: {
  key: "all" | TenantStatus;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All statuses", hint: "No status filter" },
  { key: "active", label: "Active", hint: "Good water credit" },
  { key: "low_credit", label: "Low Credit", hint: "Needs top-up or M-Pesa" },
  { key: "inactive", label: "Inactive", hint: "Account not in use" },
  { key: "overdue", label: "Overdue", hint: "Outstanding billing" },
];

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function TenantsView() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | TenantStatus>("all");
  const [buildingCategory, setBuildingCategory] = useState<string>("all");
  const [landlordId, setLandlordId] = useState<string>("all");
  const [landlordMenuOpen, setLandlordMenuOpen] = useState(false);
  const [landlordQuery, setLandlordQuery] = useState("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusQuery, setStatusQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const landlordMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (landlordMenuRef.current && !landlordMenuRef.current.contains(t)) {
        setLandlordMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(t)) {
        setStatusMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const summary = useMemo(() => {
    const total = MOCK_TENANTS.length;
    const activeMeters = MOCK_TENANTS.filter((t) => t.status === "active").length;
    const lowBalance = MOCK_TENANTS.filter((t) => t.status === "low_credit").length;
    const pendingPayments = MOCK_TENANTS.filter(
      (t) => t.status === "overdue" || t.balanceKes === 0
    ).length;
    return { total, activeMeters, lowBalance, pendingPayments };
  }, []);

  const matchesSearchAndStatus = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MOCK_TENANTS.filter((t) => {
      if (filter !== "all" && t.status !== filter) return false;
      if (landlordId !== "all" && t.landlordId !== landlordId) return false;
      if (!q) return true;
      const ll = MOCK_LANDLORDS.find((l) => l.id === t.landlordId);
      const landlordHaystack = ll
        ? `${ll.name} ${ll.company}`.toLowerCase()
        : "";
      return (
        t.name.toLowerCase().includes(q) ||
        t.meterId.toLowerCase().includes(q) ||
        t.property.toLowerCase().includes(q) ||
        t.unit.toLowerCase().includes(q) ||
        t.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        t.id.toLowerCase().includes(q) ||
        landlordHaystack.includes(q)
      );
    });
  }, [search, filter, landlordId]);

  const buildingCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of matchesSearchAndStatus) {
      map.set(t.property, (map.get(t.property) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [matchesSearchAndStatus]);

  const filtered = useMemo(() => {
    if (buildingCategory === "all") return matchesSearchAndStatus;
    return matchesSearchAndStatus.filter((t) => t.property === buildingCategory);
  }, [matchesSearchAndStatus, buildingCategory]);

  const landlordsForDropdown = useMemo(() => {
    const q = landlordQuery.trim().toLowerCase();
    return MOCK_LANDLORDS.filter(
      (l) =>
        !q ||
        l.name.toLowerCase().includes(q) ||
        l.company.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
    );
  }, [landlordQuery]);

  const selectedLandlord = MOCK_LANDLORDS.find((l) => l.id === landlordId);
  const selectedStatusOption = FILTER_OPTIONS.find((f) => f.key === filter)!;

  const statusesForDropdown = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    return FILTER_OPTIONS.filter(
      (f) =>
        !q ||
        f.label.toLowerCase().includes(q) ||
        f.hint.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q)
    );
  }, [statusQuery]);

  useEffect(() => {
    if (buildingCategory === "all") return;
    const stillExists = buildingCategories.some((b) => b.name === buildingCategory);
    if (!stillExists) setBuildingCategory("all");
  }, [buildingCategories, buildingCategory]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            Tenants
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage tenant accounts, STS meters, and water credit balances.
          </p>
        </div>
        <Link
          href="/dashboard/tenants/new"
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-10 shrink-0 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          )}
        >
          <Plus className="size-4" aria-hidden />
          Add New Tenant
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">
            Total Tenants
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.total}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">All registered</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">
            Active Meters
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.activeMeters}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Tenants with sufficient water credit
          </p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">
            Low Balance Alerts
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.lowBalance}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Needs top-up or M-Pesa payment
          </p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">
            Pending / Overdue
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.pendingPayments}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Follow up on billing
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Building2 className="size-4 shrink-0" aria-hidden />
          <span>Buildings</span>
          <span className="text-xs font-normal">
            (counts reflect search, landlord, and status filters)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setBuildingCategory("all");
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-2 text-left text-sm font-medium transition-colors",
              buildingCategory === "all"
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-muted/40 text-foreground hover:bg-muted dark:border-border/80"
            )}
          >
            All buildings
            <span className="ml-1.5 tabular-nums opacity-80">
              ({matchesSearchAndStatus.length})
            </span>
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
                "flex max-w-full rounded-full border px-3 py-2 text-left text-sm font-medium transition-colors",
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

      <div className="flex items-center justify-between gap-4">
        <div className="relative w-1/2 min-w-0">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search tenants, meters, buildings, landlord names..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-border pl-9 dark:border-border/80"
            aria-label="Search tenants"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-muted-foreground">
            Filter:
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
          <div ref={landlordMenuRef} className="relative min-w-0">
            
            <button
              type="button"
              onClick={() => {
                setLandlordMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                if (!landlordMenuOpen) setLandlordQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={landlordMenuOpen}
              aria-haspopup="listbox"
            >
              <span className="flex min-w-0 items-center gap-2">
                <UserRound className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">
                  {landlordId === "all"
                    ? "All landlords"
                    : selectedLandlord
                      ? `${selectedLandlord.name} — ${selectedLandlord.company}`
                      : "All landlords"}
                </span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  landlordMenuOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {landlordMenuOpen && (
              <div
                className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80"
                role="listbox"
                aria-label="Select landlord"
              >
                <div className="border-b border-border p-2 dark:border-border/80">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search landlords..."
                      value={landlordQuery}
                      onChange={(e) => setLandlordQuery(e.target.value)}
                      className="h-8 rounded-lg pl-8 text-sm"
                      aria-label="Search landlords"
                      autoFocus
                    />
                  </div>
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  <li>
                    <button
                      type="button"
                      role="option"
                      aria-selected={landlordId === "all"}
                      onClick={() => {
                        setLandlordId("all");
                        setLandlordMenuOpen(false);
                        setLandlordQuery("");
                        setPage(1);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                        landlordId === "all" && "bg-muted/80"
                      )}
                    >
                      {landlordId === "all" && (
                        <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                      )}
                      <span className={cn(landlordId !== "all" && "pl-6")}>
                        All landlords
                      </span>
                    </button>
                  </li>
                  {landlordsForDropdown.map((l) => (
                    <li key={l.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={landlordId === l.id}
                        onClick={() => {
                          setLandlordId(l.id);
                          setLandlordMenuOpen(false);
                          setLandlordQuery("");
                          setPage(1);
                        }}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                          landlordId === l.id && "bg-muted/80"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {landlordId === l.id && (
                            <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                          )}
                          <span className={cn("font-medium", landlordId !== l.id && "pl-6")}>
                            {l.name}
                          </span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">
                          {l.company}
                        </span>
                      </button>
                    </li>
                  ))}
                  {landlordsForDropdown.length === 0 && (
                    <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                      No landlords match.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <div ref={statusMenuRef} className="relative min-w-0">
            
            <button
              type="button"
              onClick={() => {
                setStatusMenuOpen((o) => !o);
                setLandlordMenuOpen(false);
                if (!statusMenuOpen) setStatusQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={statusMenuOpen}
              aria-haspopup="listbox"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ListFilter className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">{selectedStatusOption.label}</span>
              </span>
              <ChevronDown
                className={cn(
                  "size-4 shrink-0 text-muted-foreground transition-transform",
                  statusMenuOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {statusMenuOpen && (
              <div
                className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80"
                role="listbox"
                aria-label="Select status"
              >
                <div className="border-b border-border p-2 dark:border-border/80">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder="Search statuses..."
                      value={statusQuery}
                      onChange={(e) => setStatusQuery(e.target.value)}
                      className="h-8 rounded-lg pl-8 text-sm"
                      aria-label="Search statuses"
                      autoFocus
                    />
                  </div>
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {statusesForDropdown.map((f) => (
                    <li key={f.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={filter === f.key}
                        onClick={() => {
                          setFilter(f.key);
                          setStatusMenuOpen(false);
                          setStatusQuery("");
                          setPage(1);
                        }}
                        className={cn(
                          "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                          filter === f.key && "bg-muted/80"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {filter === f.key && (
                            <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                          )}
                          <span className={cn("font-medium", filter !== f.key && "pl-6")}>
                            {f.label}
                          </span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">
                          {f.hint}
                        </span>
                      </button>
                    </li>
                  ))}
                  {statusesForDropdown.length === 0 && (
                    <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                      No statuses match.
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-4 py-3 dark:border-border/80">
          <p className="text-sm font-medium text-foreground">Tenant list</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Tenant ID</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Landlord</th>
                <th className="px-4 py-3 font-semibold">Meter ID</th>
                <th className="px-4 py-3 font-semibold">Property / Unit</th>
                <th className="px-4 py-3 font-semibold">Current Balance</th>
                <th className="px-4 py-3 font-semibold">Last Token</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No tenants match your search or filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const ll = MOCK_LANDLORDS.find((l) => l.id === row.landlordId);
                  return (
                    <tr
                      key={row.id}
                      className="bg-card transition-colors hover:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {row.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground">
                          {row.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {ll ? (
                          <>
                            <div className="font-medium text-foreground">
                              {ll.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {ll.company}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">
                        {row.meterId}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <MapPin
                            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <div>
                            <div className="font-medium text-foreground">
                              {row.property}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.unit}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium tabular-nums text-foreground">
                        {formatKes(row.balanceKes)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          <Calendar
                            className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <div>
                            <div className="text-foreground">{row.lastTokenDate}</div>
                            <div className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                              {row.lastTokenPreview}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <TenantStatusBadge status={row.status} />
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/dashboard/tenants/${encodeURIComponent(row.id)}`}
                          className={cn(
                            "inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted dark:border-border/80"
                          )}
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 dark:border-border/80 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length === 0
              ? "Showing 0 of 0"
              : `Showing ${showingFrom}-${showingTo} of ${filtered.length}`}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                ‹
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={p === safePage ? "default" : "outline"}
                  size="icon-sm"
                  className={cn(
                    "rounded-full",
                    p === safePage &&
                      "bg-[#0A4266] text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
                  )}
                  onClick={() => setPage(p)}
                  aria-label={`Page ${p}`}
                  aria-current={p === safePage ? "page" : undefined}
                >
                  {p}
                </Button>
              ))}
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next page"
              >
                ›
              </Button>
            </div>

            <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-2.5 dark:border-border/80">
              <label
                htmlFor="tenants-page-size"
                className="whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm"
              >
                Show
              </label>
              <select
                id="tenants-page-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 min-w-[4.5rem] cursor-pointer rounded-full border-0 bg-transparent py-0 pr-6 text-sm font-medium outline-none focus-visible:ring-0"
              >
                {TABLE_PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">
                per page
              </span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground lg:text-right">
            Page {safePage} of {totalPages}
          </p>
        </div>
      </div>
    </div>
  );
}
