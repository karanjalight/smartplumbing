"use client";

import {
  Activity,
  Building2,
  Check,
  ChevronDown,
  ListFilter,
  Search,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { MeterRelayToggle } from "@/components/meters/meter-relay-toggle";
import { RefreshMeterStatusButton } from "@/components/meters/refresh-meter-status-button";
import { getLandlordMeterRowsMerged } from "@/lib/landlord-meters-data";
import { readStore } from "@/lib/landlord-portfolio-storage";
import {
  fetchMeterRowsForLandlord,
  isElectricityMeter,
  meterTypeLabel,
  TABLE_PAGE_SIZE_OPTIONS,
  type MeterConnectivity,
  type MeterLifecycleStatus,
  type MeterModelType,
  type MeterRow,
} from "@/lib/meters-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const STATUS_FILTER_OPTIONS: { key: "all" | MeterLifecycleStatus; label: string }[] = [
  { key: "all", label: "All states" },
  { key: "active", label: "Active" },
  { key: "inactive", label: "Inactive" },
  { key: "maintenance", label: "Maintenance" },
  { key: "fault", label: "Fault" },
];

const CONNECTIVITY_FILTER_OPTIONS: { key: "all" | MeterConnectivity; label: string }[] = [
  { key: "all", label: "All connectivity" },
  { key: "online", label: "Online" },
  { key: "intermittent", label: "Intermittent" },
  { key: "offline", label: "Offline" },
];

function meterStatusBadge(status: MeterLifecycleStatus) {
  const cls: Record<MeterLifecycleStatus, string> = {
    active:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    inactive: "bg-muted text-muted-foreground dark:bg-muted/80",
    maintenance:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
    fault: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        cls[status]
      )}
    >
      {status}
    </span>
  );
}

function connectivityBadge(connectivity: MeterConnectivity) {
  const cls: Record<MeterConnectivity, string> = {
    online: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    intermittent:
      "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
    offline: "bg-rose-100 text-rose-900 dark:bg-rose-950/50 dark:text-rose-200",
    unknown: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        cls[connectivity]
      )}
    >
      {connectivity === "online" ? (
        <Wifi className="size-3" />
      ) : (
        <WifiOff className="size-3" />
      )}
      {connectivity}
    </span>
  );
}

function needsAttention(row: MeterRow) {
  return (
    row.status === "fault" ||
    row.status === "maintenance" ||
    row.connectivity === "offline" ||
    row.openAlerts > 0
  );
}

export type LandlordMetersViewProps = {
  landlordId: string;
  /** Optional rows loaded on the server for first paint. */
  initialRows?: MeterRow[];
  initialListSource?: "supabase" | "mock";
};

export function LandlordMetersView({
  landlordId,
  initialRows,
  initialListSource = "supabase",
}: LandlordMetersViewProps) {
  const pathname = usePathname();
  const portfolio = useLandlordPortfolioStore();
  const [allRows, setAllRows] = useState<MeterRow[]>(initialRows ?? []);
  const [listSource, setListSource] = useState<"loading" | "mock" | "supabase">(
    initialRows !== undefined ? initialListSource : "loading",
  );

  const load = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setAllRows(getLandlordMeterRowsMerged(landlordId, readStore()));
      setListSource("mock");
      return;
    }
    try {
      const rows = await fetchMeterRowsForLandlord(supabase, landlordId);
      setAllRows(rows);
      setListSource("supabase");
    } catch {
      setAllRows(getLandlordMeterRowsMerged(landlordId, readStore()));
      setListSource("mock");
    }
  }, [landlordId]);

  useEffect(() => {
    void load();
  }, [load, pathname, portfolio]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MeterLifecycleStatus>("all");
  const [connectivityFilter, setConnectivityFilter] = useState<"all" | MeterConnectivity>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | MeterModelType>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "attention" | "healthy">("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [connectivityMenuOpen, setConnectivityMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const statusMenuRef = useRef<HTMLDivElement>(null);
  const connectivityMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (statusMenuRef.current && !statusMenuRef.current.contains(target))
        setStatusMenuOpen(false);
      if (connectivityMenuRef.current && !connectivityMenuRef.current.contains(target))
        setConnectivityMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const summary = useMemo(() => {
    const total = allRows.length;
    const online = allRows.filter((r) => r.connectivity === "online").length;
    const issues = allRows.filter(
      (r) => r.status === "fault" || r.connectivity !== "online"
    ).length;
    const withAlerts = allRows.filter((r) => r.openAlerts > 0).length;
    return { total, online, issues, withAlerts };
  }, [allRows]);

  const matchesFiltersAndSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (connectivityFilter !== "all" && r.connectivity !== connectivityFilter) return false;
      if (typeFilter !== "all" && r.modelType !== typeFilter) return false;
      if (!q) return true;
      return (
        r.meterId.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        (r.tenantName ?? "").toLowerCase().includes(q) ||
        (r.buildingName ?? "").toLowerCase().includes(q) ||
        (r.unitLabel ?? "").toLowerCase().includes(q) ||
        meterTypeLabel(r.modelType).toLowerCase().includes(q)
      );
    });
  }, [allRows, search, statusFilter, connectivityFilter, typeFilter]);

  const filtered = useMemo(() => {
    return matchesFiltersAndSearch.filter((r) => {
      if (quickFilter === "all") return true;
      if (quickFilter === "attention") return needsAttention(r);
      return (
        r.status === "active" && r.connectivity === "online" && r.openAlerts === 0
      );
    });
  }, [matchesFiltersAndSearch, quickFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  useEffect(() => setPage((p) => Math.min(p, totalPages)), [totalPages]);
  useEffect(() => setPage(1), [pageSize, quickFilter]);

  const statusLabel = STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "State";
  const connectivityLabel =
    CONNECTIVITY_FILTER_OPTIONS.find((o) => o.key === connectivityFilter)?.label ?? "Connectivity";

  if (listSource === "loading") {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">Loading meters…</div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            Smart meters
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Meters linked to your buildings and tenant units.
            {listSource === "mock"
              ? " Showing demo data — sign in with Supabase to load live meters."
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <RefreshMeterStatusButton
            meterNos={filtered.map((r) => r.meterId)}
            onDone={() => void load()}
          />
          <Link
            href="/landlords/dashboard/meters/import"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-full px-4"
            )}
          >
            <Upload className="size-4" />
            Import meters
          </Link>
          <Link
            href="/landlords/dashboard/meters/onboard"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 shrink-0 rounded-full border-[#0A4266]/40 px-4 dark:border-[#6BB4E8]/50"
            )}
          >
            Onboard meter
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">Online</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.online}</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">Issues / offline</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.issues}</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">Open alerts</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.withAlerts}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["all", "attention", "healthy"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setQuickFilter(k)}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              quickFilter === k
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-muted/40 text-foreground hover:bg-muted dark:border-border/80"
            )}
          >
            {k === "all" ? "All" : k === "attention" ? "Needs attention" : "Healthy"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search meter, supplier, tenant, building…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-border pl-9 dark:border-border/80"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value as typeof typeFilter);
            setPage(1);
          }}
          className="h-10 rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
        >
          <option value="all">All types</option>
          <option value="water_prepay_m3">Prepay water (m³)</option>
          <option value="water_prepay_currency">Prepay (currency)</option>
          <option value="postpay">Postpay</option>
        </select>
        <div ref={statusMenuRef} className="relative min-w-[180px]">
          <button
            type="button"
            onClick={() => {
              setStatusMenuOpen((o) => !o);
              setConnectivityMenuOpen(false);
            }}
            className={DROPDOWN_TRIGGER}
              aria-expanded={statusMenuOpen}
          >
            <span className="flex items-center gap-2">
              <ListFilter className="size-4 text-muted-foreground" />
              {statusLabel}
            </span>
            <ChevronDown className={cn("size-4 transition-transform", statusMenuOpen && "rotate-180")} />
          </button>
          {statusMenuOpen && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
              <ul className="p-1">
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <li key={o.key}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                        statusFilter === o.key && "bg-muted/80"
                      )}
                      onClick={() => {
                        setStatusFilter(o.key);
                        setStatusMenuOpen(false);
                        setPage(1);
                      }}
                    >
                      {statusFilter === o.key && <Check className="mr-2 inline size-4" />}
                      <span className={statusFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div ref={connectivityMenuRef} className="relative min-w-[180px]">
          <button
            type="button"
            onClick={() => {
              setConnectivityMenuOpen((o) => !o);
              setStatusMenuOpen(false);
            }}
            className={DROPDOWN_TRIGGER}
              aria-expanded={connectivityMenuOpen}
          >
            <span className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              {connectivityLabel}
            </span>
            <ChevronDown className={cn("size-4 transition-transform", connectivityMenuOpen && "rotate-180")} />
          </button>
          {connectivityMenuOpen && (
            <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
              <ul className="p-1">
                {CONNECTIVITY_FILTER_OPTIONS.map((o) => (
                  <li key={o.key}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                        connectivityFilter === o.key && "bg-muted/80"
                      )}
                      onClick={() => {
                        setConnectivityFilter(o.key);
                        setConnectivityMenuOpen(false);
                        setPage(1);
                      }}
                    >
                      {connectivityFilter === o.key && <Check className="mr-2 inline size-4" />}
                      <span className={connectivityFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Meter ID</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Tenant / unit</th>
                <th className="px-4 py-3 font-semibold">Building</th>
                <th className="px-4 py-3 font-semibold">Reading (m³)</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Connectivity</th>
                <th className="px-4 py-3 font-semibold">Alerts</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    No meters match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.meterId} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                      {row.meterId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{meterTypeLabel(row.modelType)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-foreground">{row.tenantName ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{row.unitLabel ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-foreground">{row.buildingName ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-foreground">
                      {row.latestReadingM3 ?? "—"}
                    </td>
                    <td className="px-4 py-3">{meterStatusBadge(row.status)}</td>
                    <td className="px-4 py-3">{connectivityBadge(row.connectivity)}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{row.openAlerts}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isElectricityMeter(row) ? (
                          <MeterRelayToggle
                            key={`${row.meterId}-${row.relayState}`}
                            meterNo={row.meterId}
                            relayState={row.relayState}
                            compact
                            onChanged={(next) =>
                              setAllRows((prev) =>
                                prev.map((r) =>
                                  r.meterId === row.meterId ? { ...r, relayState: next } : r
                                )
                              )
                            }
                          />
                        ) : null}
                        {row.tenantId ? (
                          <Link
                            href={`/landlords/dashboard/tenants?highlight=${encodeURIComponent(row.tenantId)}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "h-8 rounded-full px-3 text-xs"
                            )}
                          >
                            Open
                          </Link>
                        ) : null}
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
    </div>
  );
}
