"use client";

import {
  AlertTriangle,
  Banknote,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ListFilter,
  MapPin,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { deleteLandlord, previewDeleteLandlord } from "@/app/(dashboard)/dashboard/landlords/actions";
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { LandlordStatusBadge } from "@/components/dashboard/landlord-status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TABLE_PAGE_SIZE_OPTIONS,
  fetchLandlordRows,
  formatKes,
  getLandlordRows,
  type LandlordRow,
  type LandlordStatus,
  type PayoutSchedule,
} from "@/lib/landlords-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const STATUS_FILTER_OPTIONS: {
  key: "all" | LandlordStatus;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All statuses", hint: "No status filter" },
  { key: "active", label: "Active", hint: "Receiving payouts & alerts" },
  {
    key: "pending_verification",
    label: "Pending verification",
    hint: "KYC or contract in progress",
  },
  { key: "suspended", label: "Suspended", hint: "Payouts paused" },
  { key: "inactive", label: "Inactive", hint: "Account not in use" },
];

const PAYOUT_FILTER_OPTIONS: {
  key: "all" | PayoutSchedule;
  label: string;
  hint: string;
}[] = [
  { key: "all", label: "All schedules", hint: "Monthly and biweekly" },
  { key: "monthly", label: "Monthly", hint: "End-of-month settlement" },
  { key: "biweekly", label: "Biweekly", hint: "Every two weeks" },
];

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function payoutLabel(s: PayoutSchedule) {
  return s === "monthly" ? "Monthly" : "Biweekly";
}

export function LandlordsView() {
  const pathname = usePathname();
  const [allRows, setAllRows] = useState<LandlordRow[]>([]);
  const [listSource, setListSource] = useState<"loading" | "mock" | "supabase">(
    "loading",
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LandlordStatus>("all");
  const [payoutFilter, setPayoutFilter] = useState<"all" | PayoutSchedule>("all");
  const [regionCategory, setRegionCategory] = useState<string>("all");
  const [payoutMenuOpen, setPayoutMenuOpen] = useState(false);
  const [payoutQuery, setPayoutQuery] = useState("");
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [statusQuery, setStatusQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const payoutMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setAllRows(getLandlordRows());
      setListSource("mock");
      return;
    }

    try {
      const rows = await fetchLandlordRows(supabase);
      if (rows.length === 0) {
        setAllRows(getLandlordRows());
        setListSource("mock");
        return;
      }
      setAllRows(rows);
      setListSource("supabase");
    } catch {
      setAllRows(getLandlordRows());
      setListSource("mock");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (payoutMenuRef.current && !payoutMenuRef.current.contains(t)) {
        setPayoutMenuOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(t)) {
        setStatusMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const summary = useMemo(() => {
    const total = allRows.length;
    const activeAccounts = allRows.filter((r) => r.status === "active").length;
    const openAlerts = allRows.reduce((acc, r) => acc + r.openAlertsCount, 0);
    const monthlyPlatformCollection = allRows.reduce(
      (acc, r) => acc + r.monthlyCollectionKes,
      0
    );
    return { total, activeAccounts, openAlerts, monthlyPlatformCollection };
  }, [allRows]);

  const matchesSearchAndFilters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allRows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (payoutFilter !== "all" && r.payoutSchedule !== payoutFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
        r.email.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        (r.code?.toLowerCase().includes(q) ?? false) ||
        r.region.toLowerCase().includes(q)
      );
    });
  }, [allRows, search, statusFilter, payoutFilter]);

  const regionCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of matchesSearchAndFilters) {
      map.set(r.region, (map.get(r.region) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }));
  }, [matchesSearchAndFilters]);

  const filtered = useMemo(() => {
    if (regionCategory === "all") return matchesSearchAndFilters;
    return matchesSearchAndFilters.filter((r) => r.region === regionCategory);
  }, [matchesSearchAndFilters, regionCategory]);

  const payoutsForDropdown = useMemo(() => {
    const q = payoutQuery.trim().toLowerCase();
    return PAYOUT_FILTER_OPTIONS.filter(
      (f) =>
        !q ||
        f.label.toLowerCase().includes(q) ||
        f.hint.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q)
    );
  }, [payoutQuery]);

  const statusesForDropdown = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    return STATUS_FILTER_OPTIONS.filter(
      (f) =>
        !q ||
        f.label.toLowerCase().includes(q) ||
        f.hint.toLowerCase().includes(q) ||
        f.key.toLowerCase().includes(q)
    );
  }, [statusQuery]);

  const selectedPayoutOption = PAYOUT_FILTER_OPTIONS.find(
    (f) => f.key === payoutFilter
  )!;
  const selectedStatusOption = STATUS_FILTER_OPTIONS.find(
    (f) => f.key === statusFilter
  )!;

  useEffect(() => {
    if (regionCategory === "all") return;
    const stillExists = regionCategories.some((b) => b.name === regionCategory);
    if (!stillExists) setRegionCategory("all");
  }, [regionCategories, regionCategory]);

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
            Landlords
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Property owners and managers: portfolios, water revenue, payouts, and
            alerts.
          </p>
          {listSource === "loading" ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading landlords…</p>
          ) : listSource === "mock" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Showing demo data — sign in as admin with Supabase configured for live records.
            </p>
          ) : null}
        </div>
        <Link
          href="/dashboard/landlords/new"
          className={cn(
            buttonVariants({ variant: "default" }),
            "h-10 shrink-0 rounded-full bg-[#0A4266] px-4 text-white hover:bg-[#083d5c] dark:bg-[#6BB4E8] dark:text-foreground dark:hover:bg-[#5aa3d7]"
          )}
        >
          <Plus className="size-4" aria-hidden />
          Add Landlord
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">
            Total Landlords
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">On platform</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">
            Active accounts
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.activeAccounts}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Verified & receiving payouts
          </p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">Open alerts</p>
          <p className="mt-1 text-2xl font-bold text-foreground">
            {summary.openAlerts}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Meter, payment, leak flags
          </p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">
            Monthly collection
          </p>
          <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">
            {formatKes(summary.monthlyPlatformCollection)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {listSource === "supabase"
              ? "Platform water revenue"
              : "Platform water revenue (demo data)"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MapPin className="size-4 shrink-0" aria-hidden />
          <span>Region</span>
          <span className="text-xs font-normal">
            (counts reflect search, payout schedule, and status filters)
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setRegionCategory("all");
              setPage(1);
            }}
            className={cn(
              "rounded-full border px-3 py-2 text-left text-sm font-medium transition-colors",
              regionCategory === "all"
                ? "border-[#0A4266] bg-[#0A4266] text-white dark:border-[#6BB4E8] dark:bg-[#6BB4E8] dark:text-foreground"
                : "border-border bg-muted/40 text-foreground hover:bg-muted dark:border-border/80"
            )}
          >
            All regions
            <span className="ml-1.5 tabular-nums opacity-80">
              ({matchesSearchAndFilters.length})
            </span>
          </button>
          {regionCategories.map(({ name, count }) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                setRegionCategory(name);
                setPage(1);
              }}
              className={cn(
                "flex max-w-full rounded-full border px-3 py-2 text-left text-sm font-medium transition-colors",
                regionCategory === name
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

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Search name, company, phone, email, ID, region..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-full border-border pl-9 dark:border-border/80"
            aria-label="Search landlords"
          />
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:max-w-xl">
            <div ref={payoutMenuRef} className="relative min-w-0">
              <button
                type="button"
                onClick={() => {
                  setPayoutMenuOpen((o) => !o);
                  setStatusMenuOpen(false);
                  if (!payoutMenuOpen) setPayoutQuery("");
                }}
                className={DROPDOWN_TRIGGER}
                aria-expanded={payoutMenuOpen}
                aria-haspopup="listbox"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Banknote
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate">{selectedPayoutOption.label}</span>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    payoutMenuOpen && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>
              {payoutMenuOpen && (
                <div
                  className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80"
                  role="listbox"
                  aria-label="Select payout schedule"
                >
                  <div className="border-b border-border p-2 dark:border-border/80">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="search"
                        placeholder="Search schedules..."
                        value={payoutQuery}
                        onChange={(e) => setPayoutQuery(e.target.value)}
                        className="h-8 rounded-lg pl-8 text-sm"
                        aria-label="Search payout schedules"
                        autoFocus
                      />
                    </div>
                  </div>
                  <ul className="max-h-56 overflow-y-auto p-1">
                    {payoutsForDropdown.map((f) => (
                      <li key={f.key}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={payoutFilter === f.key}
                          onClick={() => {
                            setPayoutFilter(f.key);
                            setPayoutMenuOpen(false);
                            setPayoutQuery("");
                            setPage(1);
                          }}
                          className={cn(
                            "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                            payoutFilter === f.key && "bg-muted/80"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {payoutFilter === f.key && (
                              <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                            )}
                            <span
                              className={cn(
                                "font-medium",
                                payoutFilter !== f.key && "pl-6"
                              )}
                            >
                              {f.label}
                            </span>
                          </span>
                          <span className="pl-6 text-xs text-muted-foreground">
                            {f.hint}
                          </span>
                        </button>
                      </li>
                    ))}
                    {payoutsForDropdown.length === 0 && (
                      <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                        No schedules match.
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
                  setPayoutMenuOpen(false);
                  if (!statusMenuOpen) setStatusQuery("");
                }}
                className={DROPDOWN_TRIGGER}
                aria-expanded={statusMenuOpen}
                aria-haspopup="listbox"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ListFilter
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
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
                  aria-label="Select landlord status"
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
                          aria-selected={statusFilter === f.key}
                          onClick={() => {
                            setStatusFilter(f.key);
                            setStatusMenuOpen(false);
                            setStatusQuery("");
                            setPage(1);
                          }}
                          className={cn(
                            "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2 text-left text-sm hover:bg-muted",
                            statusFilter === f.key && "bg-muted/80"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {statusFilter === f.key && (
                              <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                            )}
                            <span
                              className={cn(
                                "font-medium",
                                statusFilter !== f.key && "pl-6"
                              )}
                            >
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

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-4 py-3 dark:border-border/80">
          <p className="text-sm font-medium text-foreground">Landlord directory</p>
          <p className="text-xs text-muted-foreground">
            Organization, contacts, portfolio footprint, billing, settlements, and risk signals — each in its own column.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Organization</th>
                <th className="px-4 py-3 font-semibold">Primary contact</th>
                <th className="px-4 py-3 font-semibold">Account status</th>
                <th className="px-4 py-3 font-semibold">Region</th>
                <th className="px-4 py-3 font-semibold">Portfolio</th>
                <th className="px-4 py-3 font-semibold">Water revenue</th>
                <th className="px-4 py-3 font-semibold">Settlement</th>
                <th className="px-4 py-3 font-semibold">Alerts</th>
                <th className="px-4 py-3 font-semibold">Profile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {listSource === "loading" ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    Loading landlords from Supabase…
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    No landlords match your search or filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.id} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0A4266]/15 dark:bg-[#6BB4E8]/20">
                          <Building2 className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" aria-hidden />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold leading-snug text-foreground">{row.company}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {row.code ?? row.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="max-w-[200px] px-4 py-3 align-top">
                      <div className="text-sm font-medium text-foreground">{row.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{row.phone}</div>
                      <div className="truncate text-xs text-muted-foreground" title={row.email}>
                        {row.email}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <LandlordStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex items-start gap-1.5 text-sm text-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                        {row.region}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top tabular-nums text-sm">
                      <div className="text-foreground">
                        <span className="font-medium">{row.propertiesCount}</span>
                        <span className="text-muted-foreground"> prop.</span>
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        <span className="font-medium text-foreground">{row.tenantsCount}</span> tenants
                      </div>
                      <div className="mt-0.5 text-muted-foreground">
                        <span className="font-medium text-foreground">{row.linkedMetersCount}</span> meters
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold tabular-nums text-foreground">
                        {formatKes(row.monthlyCollectionKes)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">/ mo</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {listSource === "supabase" ? "Platform water roll-up" : "Platform water roll-up (demo)"}
                      </p>
                    </td>
                    <td className="min-w-[140px] px-4 py-3 align-top">
                      <p className="text-sm font-medium text-foreground">{payoutLabel(row.payoutSchedule)}</p>
                      <div className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="mt-0.5 size-3.5 shrink-0 opacity-80" aria-hidden />
                        <div className="space-y-1 leading-snug">
                          <div>
                            <span className="text-[10px] uppercase tracking-wide">Last</span>{" "}
                            <span className="text-foreground">{row.lastPayoutDate ?? "—"}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase tracking-wide">Next</span>{" "}
                            <span className="text-foreground">{row.nextPayoutDate}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.openAlertsCount > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                          <AlertTriangle className="size-3" aria-hidden />
                          {row.openAlertsCount}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/landlords/${encodeURIComponent(row.id)}`}
                          className={cn(
                            buttonVariants({ variant: "outline", size: "sm" }),
                            "h-7 rounded-full px-3 text-xs"
                          )}
                        >
                          View
                        </Link>
                        <DeleteRowButton
                          preview={() => previewDeleteLandlord(row.id)}
                          onDelete={() => deleteLandlord(row.id)}
                          title="Delete landlord and entire portfolio?"
                          description={`This permanently deletes "${row.company}" with all its buildings, houses, tenants (and their logins), and payouts.`}
                          confirmLabel="Delete everything"
                          requireConfirmText={row.company}
                          successMessage="Landlord deleted"
                          onDeleted={() => setAllRows((prev) => prev.filter((r) => r.id !== row.id))}
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
                htmlFor="landlords-page-size"
                className="whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm"
              >
                Show
              </label>
              <select
                id="landlords-page-size"
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
