"use client";

import {
  Activity,
  Building2,
  Check,
  ChevronDown,
  Gauge,
  ListFilter,
  Plus,
  Radar,
  Search,
  TriangleAlert,
  Upload,
  UserRound,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { deleteMeter, previewDeleteMeter } from "@/app/(dashboard)/dashboard/meters/actions";
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchMeterRows,
  getMeterRows,
  meterTypeLabel,
  TABLE_PAGE_SIZE_OPTIONS,
  utilityOfModelType,
  type MeterConnectivity,
  type MeterLifecycleStatus,
  type MeterModelType,
  type MeterRow,
  type MeterUtility,
} from "@/lib/meters-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const STATUS_FILTER_OPTIONS: {
  key: "all" | MeterLifecycleStatus;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All meter states", hint: "No lifecycle filter" },
  { key: "active", label: "Active", hint: "Meter can vend and sync" },
  { key: "inactive", label: "Inactive", hint: "Not currently in service" },
  { key: "maintenance", label: "Maintenance", hint: "Field work in progress" },
  { key: "fault", label: "Fault", hint: "Abnormal or hardware issues" },
];

const CONNECTIVITY_FILTER_OPTIONS: {
  key: "all" | MeterConnectivity;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All connectivity", hint: "Online and offline meters" },
  { key: "online", label: "Online", hint: "Connected and reporting" },
  { key: "intermittent", label: "Intermittent", hint: "Unstable reporting" },
  { key: "offline", label: "Offline", hint: "No recent sync" },
  { key: "unknown", label: "Unknown", hint: "Connectivity not yet confirmed" },
];

const TYPE_FILTER_OPTIONS: {
  key: "all" | MeterModelType;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All meter types", hint: "STS + postpay" },
  { key: "water_prepay_m3", label: "Prepay water (m3)", hint: "LONGi meterType 1" },
  { key: "water_prepay_currency", label: "Prepay water (currency)", hint: "Currency-denominated prepaid" },
  { key: "postpay", label: "Postpay", hint: "Billed after consumption" },
];

const UTILITY_FILTER_OPTIONS: {
  key: "all" | MeterUtility;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All utilities", hint: "Water + electricity meters" },
  { key: "water", label: "Water", hint: "Water prepay + postpay meters" },
  { key: "electricity", label: "Electricity", hint: "Electricity prepay meters" },
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
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", cls[status])}>
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
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", cls[connectivity])}>
      {connectivity === "online" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
      {connectivity}
    </span>
  );
}

function meterNeedsAttention(row: MeterRow): boolean {
  return (
    row.status === "fault" ||
    row.status === "maintenance" ||
    row.connectivity === "offline" ||
    row.openAlerts > 0
  );
}

function meterIsHealthy(row: MeterRow): boolean {
  return row.status === "active" && row.connectivity === "online" && row.openAlerts === 0;
}

export function MetersView() {
  const pathname = usePathname();
  const [allRows, setAllRows] = useState<MeterRow[]>([]);
  const [listSource, setListSource] = useState<"loading" | "mock" | "supabase">(
    "loading",
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | MeterLifecycleStatus>("all");
  const [connectivityFilter, setConnectivityFilter] = useState<"all" | MeterConnectivity>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | MeterModelType>("all");
  const [utilityFilter, setUtilityFilter] = useState<"all" | MeterUtility>("all");
  const [quickFilter, setQuickFilter] = useState<"all" | "attention" | "healthy">("all");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusQuery, setStatusQuery] = useState("");
  const [connectivityMenuOpen, setConnectivityMenuOpen] = useState(false);
  const [connectivityQuery, setConnectivityQuery] = useState("");
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [typeQuery, setTypeQuery] = useState("");
  const [utilityMenuOpen, setUtilityMenuOpen] = useState(false);
  const [utilityQuery, setUtilityQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const statusMenuRef = useRef<HTMLDivElement>(null);
  const connectivityMenuRef = useRef<HTMLDivElement>(null);
  const typeMenuRef = useRef<HTMLDivElement>(null);
  const utilityMenuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setAllRows(getMeterRows());
      setListSource("mock");
      return;
    }

    try {
      const rows = await fetchMeterRows(supabase);
      setAllRows(rows);
      setListSource("supabase");
    } catch {
      setAllRows(getMeterRows());
      setListSource("mock");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (statusMenuRef.current && !statusMenuRef.current.contains(target)) setStatusMenuOpen(false);
      if (connectivityMenuRef.current && !connectivityMenuRef.current.contains(target)) setConnectivityMenuOpen(false);
      if (typeMenuRef.current && !typeMenuRef.current.contains(target)) setTypeMenuOpen(false);
      if (utilityMenuRef.current && !utilityMenuRef.current.contains(target)) setUtilityMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const summary = useMemo(() => {
    const total = allRows.length;
    const online = allRows.filter((r) => r.connectivity === "online").length;
    const issues = allRows.filter((r) => r.status === "fault" || r.connectivity !== "online").length;
    const withAlerts = allRows.filter((r) => r.openAlerts > 0).length;
    return { total, online, issues, withAlerts };
  }, [allRows]);

  const matchesFiltersAndSearch = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (connectivityFilter !== "all" && r.connectivity !== connectivityFilter) return false;
      if (typeFilter !== "all" && r.modelType !== typeFilter) return false;
      if (utilityFilter !== "all" && utilityOfModelType(r.modelType) !== utilityFilter) return false;
      if (!q) return true;
      return (
        r.meterId.toLowerCase().includes(q) ||
        r.supplier.toLowerCase().includes(q) ||
        (r.tenantName ?? "").toLowerCase().includes(q) ||
        (r.tenantId ?? "").toLowerCase().includes(q) ||
        (r.buildingName ?? "").toLowerCase().includes(q) ||
        (r.unitLabel ?? "").toLowerCase().includes(q) ||
        (r.landlordCompany ?? "").toLowerCase().includes(q) ||
        meterTypeLabel(r.modelType).toLowerCase().includes(q)
      );
    });
  }, [allRows, search, statusFilter, connectivityFilter, typeFilter, utilityFilter]);

  const quickFilterCounts = useMemo(() => {
    const base = matchesFiltersAndSearch;
    return {
      all: base.length,
      attention: base.filter(meterNeedsAttention).length,
      healthy: base.filter(meterIsHealthy).length,
    };
  }, [matchesFiltersAndSearch]);

  const filtered = useMemo(() => {
    return matchesFiltersAndSearch.filter((r) => {
      if (quickFilter === "all") return true;
      if (quickFilter === "attention") return meterNeedsAttention(r);
      return meterIsHealthy(r);
    });
  }, [matchesFiltersAndSearch, quickFilter]);

  const statusOptions = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    return STATUS_FILTER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q));
  }, [statusQuery]);

  const connectivityOptions = useMemo(() => {
    const q = connectivityQuery.trim().toLowerCase();
    return CONNECTIVITY_FILTER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q));
  }, [connectivityQuery]);

  const typeOptions = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    return TYPE_FILTER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q));
  }, [typeQuery]);

  const utilityOptions = useMemo(() => {
    const q = utilityQuery.trim().toLowerCase();
    return UTILITY_FILTER_OPTIONS.filter((o) => !q || o.label.toLowerCase().includes(q) || o.hint.toLowerCase().includes(q) || o.key.includes(q));
  }, [utilityQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => setPage((p) => Math.min(p, totalPages)), [totalPages]);
  useEffect(() => setPage(1), [pageSize, quickFilter]);

  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  const statusLabel = STATUS_FILTER_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "All meter states";
  const connectivityLabel = CONNECTIVITY_FILTER_OPTIONS.find((o) => o.key === connectivityFilter)?.label ?? "All connectivity";
  const typeLabel = TYPE_FILTER_OPTIONS.find((o) => o.key === typeFilter)?.label ?? "All meter types";
  const utilityLabel = UTILITY_FILTER_OPTIONS.find((o) => o.key === utilityFilter)?.label ?? "All utilities";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">All Meters</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            STS meter fleet: readings, sync, link health, and where each device is installed (assignment is secondary).
          </p>
          {listSource === "loading" ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading meters…</p>
          ) : listSource === "mock" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Showing demo data — sign in as admin with Supabase configured for live records.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/dashboard/meters/import"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "h-10 rounded-full px-4"
            )}
          >
            <Upload className="size-4" />
            Import meters
          </Link>
          <Link
            href="/dashboard/meters/onboard"
            className={cn(
              buttonVariants({ variant: "default" }),
              "h-10 shrink-0 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
            )}
          >
            <Plus className="size-4" />
            Onboard Meter
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total Meters</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Inventory on platform</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">Online Meters</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.online}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Currently reporting readings</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">Connectivity / Faults</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.issues}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Needs inspection or follow-up</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">Open Alerts</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.withAlerts}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Abnormal activity or sync warnings</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Radar className="size-4 shrink-0" />
          <span>Fleet health</span>
          <span className="text-xs font-normal">(uses search + filters below)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setQuickFilter("all")}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              quickFilter === "all"
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-muted/40 text-foreground hover:bg-muted dark:border-border/80"
            )}
          >
            All meters <span className="ml-1.5 tabular-nums opacity-80">({quickFilterCounts.all})</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickFilter("attention")}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              quickFilter === "attention"
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-card text-foreground hover:bg-muted dark:border-border/80"
            )}
          >
            Needs attention <span className="ml-1.5 tabular-nums opacity-80">({quickFilterCounts.attention})</span>
          </button>
          <button
            type="button"
            onClick={() => setQuickFilter("healthy")}
            className={cn(
              "rounded-full border px-3 py-2 text-sm font-medium transition-colors",
              quickFilter === "healthy"
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-card text-foreground hover:bg-muted dark:border-border/80"
            )}
          >
            Healthy <span className="ml-1.5 tabular-nums opacity-80">({quickFilterCounts.healthy})</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search meter ID, supplier, type, site, tenant…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-border pl-9 dark:border-border/80"
            aria-label="Search meters"
          />
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
          <div ref={utilityMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setUtilityMenuOpen((o) => !o);
                setTypeMenuOpen(false);
                setStatusMenuOpen(false);
                setConnectivityMenuOpen(false);
                if (!utilityMenuOpen) setUtilityQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={utilityMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Zap className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{utilityLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", utilityMenuOpen && "rotate-180")} />
            </button>
            {utilityMenuOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80" role="listbox">
                <div className="border-b border-border p-2 dark:border-border/80">
                  <Input
                    type="search"
                    placeholder="Search utilities..."
                    value={utilityQuery}
                    onChange={(e) => setUtilityQuery(e.target.value)}
                    className="h-8 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {utilityOptions.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={utilityFilter === o.key}
                        onClick={() => {
                          setUtilityFilter(o.key);
                          setUtilityMenuOpen(false);
                          setUtilityQuery("");
                          setPage(1);
                        }}
                        className={cn("flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted", utilityFilter === o.key && "bg-muted/80")}
                      >
                        <span className="flex items-center gap-2">
                          {utilityFilter === o.key && <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={cn("font-medium", utilityFilter !== o.key && "pl-6")}>{o.label}</span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div ref={typeMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setTypeMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                setConnectivityMenuOpen(false);
                setUtilityMenuOpen(false);
                if (!typeMenuOpen) setTypeQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={typeMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Gauge className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{typeLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", typeMenuOpen && "rotate-180")} />
            </button>
            {typeMenuOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80" role="listbox">
                <div className="border-b border-border p-2 dark:border-border/80">
                  <Input
                    type="search"
                    placeholder="Search meter types..."
                    value={typeQuery}
                    onChange={(e) => setTypeQuery(e.target.value)}
                    className="h-8 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {typeOptions.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={typeFilter === o.key}
                        onClick={() => {
                          setTypeFilter(o.key);
                          setTypeMenuOpen(false);
                          setTypeQuery("");
                          setPage(1);
                        }}
                        className={cn("flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted", typeFilter === o.key && "bg-muted/80")}
                      >
                        <span className="flex items-center gap-2">
                          {typeFilter === o.key && <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={cn("font-medium", typeFilter !== o.key && "pl-6")}>{o.label}</span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div ref={connectivityMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setConnectivityMenuOpen((o) => !o);
                setStatusMenuOpen(false);
                setTypeMenuOpen(false);
                setUtilityMenuOpen(false);
                if (!connectivityMenuOpen) setConnectivityQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={connectivityMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <Activity className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{connectivityLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", connectivityMenuOpen && "rotate-180")} />
            </button>
            {connectivityMenuOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80" role="listbox">
                <div className="border-b border-border p-2 dark:border-border/80">
                  <Input
                    type="search"
                    placeholder="Search connectivity..."
                    value={connectivityQuery}
                    onChange={(e) => setConnectivityQuery(e.target.value)}
                    className="h-8 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {connectivityOptions.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={connectivityFilter === o.key}
                        onClick={() => {
                          setConnectivityFilter(o.key);
                          setConnectivityMenuOpen(false);
                          setConnectivityQuery("");
                          setPage(1);
                        }}
                        className={cn("flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted", connectivityFilter === o.key && "bg-muted/80")}
                      >
                        <span className="flex items-center gap-2">
                          {connectivityFilter === o.key && <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={cn("font-medium", connectivityFilter !== o.key && "pl-6")}>{o.label}</span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div ref={statusMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => {
                setStatusMenuOpen((o) => !o);
                setConnectivityMenuOpen(false);
                setTypeMenuOpen(false);
                setUtilityMenuOpen(false);
                if (!statusMenuOpen) setStatusQuery("");
              }}
              className={DROPDOWN_TRIGGER}
              aria-expanded={statusMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <ListFilter className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{statusLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", statusMenuOpen && "rotate-180")} />
            </button>
            {statusMenuOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80" role="listbox">
                <div className="border-b border-border p-2 dark:border-border/80">
                  <Input
                    type="search"
                    placeholder="Search statuses..."
                    value={statusQuery}
                    onChange={(e) => setStatusQuery(e.target.value)}
                    className="h-8 rounded-lg text-sm"
                    autoFocus
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto p-1">
                  {statusOptions.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={statusFilter === o.key}
                        onClick={() => {
                          setStatusFilter(o.key);
                          setStatusMenuOpen(false);
                          setStatusQuery("");
                          setPage(1);
                        }}
                        className={cn("flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted", statusFilter === o.key && "bg-muted/80")}
                      >
                        <span className="flex items-center gap-2">
                          {statusFilter === o.key && <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={cn("font-medium", statusFilter !== o.key && "pl-6")}>{o.label}</span>
                        </span>
                        <span className="pl-6 text-xs text-muted-foreground">{o.hint}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-4 py-3 dark:border-border/80">
          <p className="text-sm font-medium text-foreground">Meter fleet</p>
          <p className="text-xs text-muted-foreground">Device identity and telemetry first; links to accounts and sites are shortcuts.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1020px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Meter</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Installed</th>
                <th className="px-4 py-3 font-semibold">Reading</th>
                <th className="px-4 py-3 font-semibold">Connectivity</th>
                <th className="px-4 py-3 font-semibold">Device status</th>
                <th className="px-4 py-3 font-semibold">Alerts</th>
                <th className="px-4 py-3 font-semibold">Assignment</th>
                <th className="px-4 py-3 font-semibold">Shortcuts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listSource === "loading" ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    Loading meters from Supabase…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    {allRows.length === 0
                      ? "No meters in inventory yet. Onboard a meter to get started."
                      : "No meters match your search or filters."}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.meterId} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs font-semibold text-foreground">{row.meterId}</div>
                      <div className="text-xs text-muted-foreground">{row.supplier}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">{meterTypeLabel(row.modelType)}</td>
                    <td className="px-4 py-3 tabular-nums text-foreground">{row.installedOn}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {row.latestReadingM3 == null ? "—" : `${row.latestReadingM3.toLocaleString("en-KE")} m³`}
                      </div>
                      <div className="text-xs text-muted-foreground">Last sync {row.lastSyncAt}</div>
                    </td>
                    <td className="px-4 py-3">{connectivityBadge(row.connectivity)}</td>
                    <td className="px-4 py-3">{meterStatusBadge(row.status)}</td>
                    <td className="px-4 py-3">
                      {row.openAlerts > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                          <TriangleAlert className="size-3" />
                          {row.openAlerts}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="max-w-[220px] px-4 py-3">
                      {row.tenantId && row.tenantName ? (
                        <div className="space-y-1">
                          <div className="truncate">
                            <Link
                              href={`/dashboard/tenants/${encodeURIComponent(row.tenantId)}`}
                              className="font-medium text-foreground hover:text-[#0A4266] dark:hover:text-[#6BB4E8]"
                            >
                              {row.tenantName}
                            </Link>
                            {row.unitLabel ? (
                              <span className="text-muted-foreground"> · {row.unitLabel}</span>
                            ) : null}
                          </div>
                          {row.buildingId && row.buildingName ? (
                            <div className="truncate text-xs">
                              <Building2 className="mr-1 inline size-3 text-muted-foreground" />
                              <Link
                                href={`/dashboard/buildings/${row.buildingId}`}
                                className="text-muted-foreground hover:text-[#0A4266] dark:hover:text-[#6BB4E8]"
                              >
                                {row.buildingName}
                              </Link>
                            </div>
                          ) : null}
                          {row.landlordId && row.landlordCompany ? (
                            <div className="truncate text-xs text-muted-foreground">
                              <UserRound className="mr-1 inline size-3 opacity-70" />
                              <Link
                                href={`/dashboard/landlords/${encodeURIComponent(row.landlordId)}`}
                                className="hover:text-[#0A4266] dark:hover:text-[#6BB4E8]"
                              >
                                {row.landlordCompany}
                              </Link>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.tenantId ? (
                          <Link
                            href={`/dashboard/tenants/${encodeURIComponent(row.tenantId)}`}
                            className="inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted dark:border-border/80"
                          >
                            Tenant
                          </Link>
                        ) : null}
                        {row.buildingId ? (
                          <Link
                            href={`/dashboard/buildings/${row.buildingId}`}
                            className="inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-2.5 text-xs font-medium transition-colors hover:bg-muted dark:border-border/80"
                          >
                            Site
                          </Link>
                        ) : null}
                        {!row.tenantId && !row.buildingId ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : null}
                        <DeleteRowButton
                          preview={() => previewDeleteMeter(row.meterId)}
                          onDelete={() => deleteMeter(row.meterId)}
                          title="Delete meter?"
                          description={`Meter ${row.meterId} will be permanently deleted and unassigned from any tenant.`}
                          successMessage="Meter deleted"
                          onDeleted={() => setAllRows((prev) => prev.filter((r) => r.meterId !== row.meterId))}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 dark:border-border/80 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
          <p className="text-sm text-muted-foreground">
            {filtered.length === 0 ? "Showing 0 of 0" : `Showing ${showingFrom}-${showingTo} of ${filtered.length}`}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon-sm" className="rounded-full" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
                  aria-current={p === safePage ? "page" : undefined}
                >
                  {p}
                </Button>
              ))}
              <Button type="button" variant="outline" size="icon-sm" className="rounded-full" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                ›
              </Button>
            </div>

            <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-2.5 dark:border-border/80">
              <label htmlFor="meters-page-size" className="whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm">
                Show
              </label>
              <select
                id="meters-page-size"
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
              <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">per page</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground lg:text-right">Page {safePage} of {totalPages}</p>
        </div>
      </div>
    </div>
  );
}
