"use client";

import {
  ArrowDownToLine,
  ArrowUpDown,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  Droplets,
  Home,
  Search,
  UserRound,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { LandlordPaymentRecordModal } from "@/components/landlord/landlord-payment-record-modal";
import { useLandlordFinanceStore } from "@/components/landlord/use-landlord-finance-store";
import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildInitialDashboardPayments,
  categoryLabel,
  methodLabel,
  PAYMENTS_PAGE_SIZE_OPTIONS,
  type DashboardPayment,
  type PaymentCategory,
} from "@/lib/payments-data";
import { mergeDashboardPaymentsForLandlord } from "@/lib/landlord-finance-storage";
import { type PaymentRow } from "@/lib/tenants-data";
import { cn } from "@/lib/utils";

const DEMO_TODAY = new Date("2026-04-05T23:59:59.000Z");

const PERIOD_OPTIONS = [
  { key: "all" as const, label: "All time" },
  { key: "7d" as const, label: "Last 7 days" },
  { key: "30d" as const, label: "Last 30 days" },
  { key: "90d" as const, label: "Last 90 days" },
];

const STATUS_OPTIONS: { key: "all" | PaymentRow["status"]; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

const METHOD_OPTIONS: { key: "all" | PaymentRow["method"]; label: string }[] = [
  { key: "all", label: "All methods" },
  { key: "M-Pesa", label: "M-Pesa" },
  { key: "STS credit", label: "STS credit" },
  { key: "Bank", label: "Bank" },
  { key: "Cash", label: "Cash" },
];

const CATEGORY_OPTIONS: { key: "all" | PaymentCategory; label: string }[] = [
  { key: "all", label: "All payment types" },
  { key: "rent", label: "Rent" },
  { key: "tokens", label: "Tokens (water)" },
  { key: "service", label: "Service charges" },
];

export type PaymentSortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const SORT_OPTIONS: { key: PaymentSortKey; label: string; hint: string }[] = [
  { key: "date_desc", label: "Newest first", hint: "By payment time" },
  { key: "date_asc", label: "Oldest first", hint: "By payment time" },
  { key: "amount_desc", label: "Amount high → low", hint: "Largest KES first" },
  { key: "amount_asc", label: "Amount low → high", hint: "Smallest KES first" },
];

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function paymentCategoryBadge(category: PaymentCategory) {
  const styles: Record<PaymentCategory, string> = {
    rent: "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-200",
    tokens: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
    service: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  };
  const Icon = category === "rent" ? Home : category === "tokens" ? Droplets : Wrench;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        styles[category]
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
      {categoryLabel(category)}
    </span>
  );
}

function paymentStatusBadge(status: PaymentRow["status"]) {
  const map = {
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    pending: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize",
        map[status]
      )}
    >
      {status}
    </span>
  );
}

function periodCutoff(period: (typeof PERIOD_OPTIONS)[number]["key"]): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const d = new Date(DEMO_TODAY);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-KE", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export type PaymentsViewProps = {
  /** When set, only payments from tenants linked to this landlord are shown (landlord portal). */
  landlordPortalId?: string;
};

export function PaymentsView({ landlordPortalId }: PaymentsViewProps) {
  const portfolio = useLandlordPortfolioStore();
  const financeStore = useLandlordFinanceStore();

  const payments = useMemo(() => {
    const all = buildInitialDashboardPayments();
    if (!landlordPortalId) return all;
    if (!portfolio || !financeStore) return [];
    return mergeDashboardPaymentsForLandlord(landlordPortalId, portfolio, financeStore);
  }, [landlordPortalId, portfolio, financeStore]);

  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<(typeof PERIOD_OPTIONS)[number]["key"]>("30d");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["key"]>("all");
  const [methodFilter, setMethodFilter] = useState<(typeof METHOD_OPTIONS)[number]["key"]>("all");
  const [categoryFilter, setCategoryFilter] = useState<(typeof CATEGORY_OPTIONS)[number]["key"]>("all");
  const [sortKey, setSortKey] = useState<PaymentSortKey>("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(16);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const methodRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeAll(e: PointerEvent) {
      const t = e.target as Node;
      if (periodRef.current && !periodRef.current.contains(t)) setPeriodOpen(false);
      if (statusRef.current && !statusRef.current.contains(t)) setStatusOpen(false);
      if (methodRef.current && !methodRef.current.contains(t)) setMethodOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(t)) setCategoryOpen(false);
      if (sortRef.current && !sortRef.current.contains(t)) setSortOpen(false);
    }
    document.addEventListener("pointerdown", closeAll);
    return () => document.removeEventListener("pointerdown", closeAll);
  }, []);

  const filtered = useMemo(() => {
    const cutoff = periodCutoff(period);
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (cutoff && new Date(p.createdAtIso) < cutoff) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (categoryFilter !== "all" && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.tenantName.toLowerCase().includes(q) ||
        p.tenantId.toLowerCase().includes(q) ||
        p.meterNo.toLowerCase().includes(q) ||
        p.reference.toLowerCase().includes(q) ||
        p.property.toLowerCase().includes(q) ||
        categoryLabel(p.category).toLowerCase().includes(q)
      );
    });
  }, [payments, search, period, statusFilter, methodFilter, categoryFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "date_desc":
          return b.createdAtIso.localeCompare(a.createdAtIso);
        case "date_asc":
          return a.createdAtIso.localeCompare(b.createdAtIso);
        case "amount_desc":
          return b.amountKes - a.amountKes;
        case "amount_asc":
          return a.amountKes - b.amountKes;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey]);

  const summary = useMemo(() => {
    const completed = filtered.filter((p) => p.status === "completed");
    const pending = filtered.filter((p) => p.status === "pending");
    const failed = filtered.filter((p) => p.status === "failed");
    const volume = completed.reduce((s, p) => s + p.amountKes, 0);
    const pendingKes = pending.reduce((s, p) => s + p.amountKes, 0);
    const rentKes = completed.filter((p) => p.category === "rent").reduce((s, p) => s + p.amountKes, 0);
    const tokensKes = completed.filter((p) => p.category === "tokens").reduce((s, p) => s + p.amountKes, 0);
    const serviceKes = completed.filter((p) => p.category === "service").reduce((s, p) => s + p.amountKes, 0);
    return {
      count: filtered.length,
      completedCount: completed.length,
      volumeKes: volume,
      pendingCount: pending.length,
      pendingKes,
      failedCount: failed.length,
      rentKes,
      tokensKes,
      serviceKes,
    };
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(start, start + pageSize);
  const showingFrom = sorted.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  function exportCsv() {
    const headers = [
      "Reference",
      "Tenant",
      "Property",
      "Meter",
      "Payment type",
      "Method",
      "Amount (KES)",
      "Status",
      "When (UTC)",
      "Tenant ID",
    ];
    const lines = [
      headers.join(","),
      ...sorted.map((p) =>
        [
          `"${p.reference.replace(/"/g, '""')}"`,
          `"${p.tenantName.replace(/"/g, '""')}"`,
          `"${p.property.replace(/"/g, '""')}"`,
          p.meterNo,
          categoryLabel(p.category),
          `"${p.method}"`,
          p.amountKes,
          p.status,
          `"${p.createdAtIso}"`,
          p.tenantId,
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export ready", { description: `${sorted.length} row(s) downloaded.` });
  }

  const periodLabel = PERIOD_OPTIONS.find((o) => o.key === period)?.label ?? "Period";
  const statusLabel = STATUS_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "Status";
  const methodLabelSel = METHOD_OPTIONS.find((o) => o.key === methodFilter)?.label ?? "Method";
  const categoryFilterLabel = CATEGORY_OPTIONS.find((o) => o.key === categoryFilter)?.label ?? "Payment type";
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {landlordPortalId ? "Tenant payments" : "Payments"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {landlordPortalId
              ? "Collections from your tenants (rent, water tokens, and other charges). Use View tenant to open the tenant account. Filter by period, method, and status to match statements."
              : "Reconcile by payment type (rent, water tokens, service charges), then method and status. Sort by date or amount to match bank or M-Pesa statements. Use View to open the tenant account."}
          </p>
        </div>
        <div
          className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15"
          aria-hidden
        >
          <CreditCard className="size-10 text-[#0A4266] dark:text-[#6BB4E8]" />
        </div>
      </div>


      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Completed volume</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {summary.volumeKes.toLocaleString("en-KE")} <span className="text-lg font-semibold">KES</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{summary.completedCount} completed in view</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50/80 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/25">
          <p className="text-sm font-medium text-muted-foreground">Rent (completed)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {summary.rentKes.toLocaleString("en-KE")} <span className="text-base font-semibold">KES</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Lease / occupancy in current filters</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50/80 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/25">
          <p className="text-sm font-medium text-muted-foreground">Tokens (completed)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {summary.tokensKes.toLocaleString("en-KE")} <span className="text-base font-semibold">KES</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">STS / prepaid water credit</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50/80 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/25">
          <p className="text-sm font-medium text-muted-foreground">Service (completed)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {summary.serviceKes.toLocaleString("en-KE")} <span className="text-base font-semibold">KES</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Maintenance, fees, other charges</p>
        </div>
      </div>

      <div className="">
        <div className="space-y-4 ">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search tenant, meter, reference, property, type…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-full border-border pl-9 dark:border-border/80"
                aria-label="Search payments"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full gap-2"
                onClick={() => void exportCsv()}
                disabled={sorted.length === 0}
              >
                <ArrowDownToLine className="size-4" />
                Export CSV
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <div ref={periodRef} className="relative min-w-[200px] flex-1 sm:max-w-[220px]">
              <button
                type="button"
                onClick={() => setPeriodOpen((o) => !o)}
                className={DROPDOWN_TRIGGER}
                aria-expanded={periodOpen}
              >
                <span className="truncate">{periodLabel}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", periodOpen && "rotate-180")}
                />
              </button>
              {periodOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="p-1" role="listbox">
                    {PERIOD_OPTIONS.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            period === o.key && "bg-muted/80"
                          )}
                          onClick={() => {
                            setPeriod(o.key);
                            setPeriodOpen(false);
                            setPage(1);
                          }}
                        >
                          {period === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={period !== o.key ? "pl-6" : ""}>{o.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div ref={statusRef} className="relative min-w-[200px] flex-1 sm:max-w-[200px]">
              <button
                type="button"
                onClick={() => setStatusOpen((o) => !o)}
                className={DROPDOWN_TRIGGER}
                aria-expanded={statusOpen}
              >
                <span className="truncate">{statusLabel}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", statusOpen && "rotate-180")}
                />
              </button>
              {statusOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="p-1" role="listbox">
                    {STATUS_OPTIONS.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            statusFilter === o.key && "bg-muted/80"
                          )}
                          onClick={() => {
                            setStatusFilter(o.key);
                            setStatusOpen(false);
                            setPage(1);
                          }}
                        >
                          {statusFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={statusFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div ref={methodRef} className="relative min-w-[200px] flex-1 sm:max-w-[220px]">
              <button
                type="button"
                onClick={() => setMethodOpen((o) => !o)}
                className={DROPDOWN_TRIGGER}
                aria-expanded={methodOpen}
              >
                <span className="truncate">{methodLabelSel}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", methodOpen && "rotate-180")}
                />
              </button>
              {methodOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="max-h-64 overflow-y-auto p-1" role="listbox">
                    {METHOD_OPTIONS.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            methodFilter === o.key && "bg-muted/80"
                          )}
                          onClick={() => {
                            setMethodFilter(o.key);
                            setMethodOpen(false);
                            setPage(1);
                          }}
                        >
                          {methodFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={methodFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div ref={categoryRef} className="relative min-w-[200px] flex-1 sm:max-w-[240px]">
              <button
                type="button"
                onClick={() => setCategoryOpen((o) => !o)}
                className={DROPDOWN_TRIGGER}
                aria-expanded={categoryOpen}
              >
                <span className="truncate">{categoryFilterLabel}</span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", categoryOpen && "rotate-180")}
                />
              </button>
              {categoryOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="max-h-64 overflow-y-auto p-1" role="listbox">
                    {CATEGORY_OPTIONS.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={categoryFilter === o.key}
                          className={cn(
                            "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            categoryFilter === o.key && "bg-muted/80"
                          )}
                          onClick={() => {
                            setCategoryFilter(o.key);
                            setCategoryOpen(false);
                            setPage(1);
                          }}
                        >
                          {categoryFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                          <span className={categoryFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div ref={sortRef} className="relative min-w-[200px] flex-1 sm:max-w-[260px]">
              <button
                type="button"
                onClick={() => setSortOpen((o) => !o)}
                className={DROPDOWN_TRIGGER}
                aria-expanded={sortOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{sortLabel}</span>
                </span>
                <ChevronDown
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform", sortOpen && "rotate-180")}
                />
              </button>
              {sortOpen && (
                <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
                    {SORT_OPTIONS.map((o) => (
                      <li key={o.key}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={sortKey === o.key}
                          className={cn(
                            "flex w-full flex-col gap-0.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            sortKey === o.key && "bg-muted/80"
                          )}
                          onClick={() => {
                            setSortKey(o.key);
                            setSortOpen(false);
                            setPage(1);
                          }}
                        >
                          <span className="flex items-center gap-2">
                            {sortKey === o.key && <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />}
                            <span className={cn("font-medium", sortKey !== o.key && "pl-6")}>{o.label}</span>
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

          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-left text-sm">
                <thead>
                  <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                    <th className="px-4 py-3 font-semibold">Reference</th>
                    <th className="px-4 py-3 font-semibold">Tenant</th>
                    <th className="px-4 py-3 font-semibold">Meter</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Method</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                        No payments match your filters.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id} className="bg-card transition-colors hover:bg-muted/40">
                        <td className="max-w-[220px] px-4 py-3">
                          <span className="font-mono text-xs break-all text-foreground">{row.reference}</span>
                        </td>
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1 font-medium text-foreground">
                              <UserRound className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                              <span className="truncate">{row.tenantName}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <Building2 className="size-3 shrink-0" aria-hidden />
                              {row.property}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{row.meterNo}</td>
                        <td className="px-4 py-3 align-top">{paymentCategoryBadge(row.category)}</td>
                        <td className="px-4 py-3 text-foreground">{methodLabel(row.method)}</td>
                        <td className="px-4 py-3 tabular-nums text-foreground">{row.amountKes.toLocaleString("en-KE")} KES</td>
                        <td className="px-4 py-3">{paymentStatusBadge(row.status)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatWhen(row.createdAtIso)}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={
                              landlordPortalId
                                ? `/landlords/dashboard/tenants/${encodeURIComponent(row.tenantId)}`
                                : `/dashboard/tenants/${encodeURIComponent(row.tenantId)}?payment=${encodeURIComponent(row.id)}`
                            }
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "inline-flex h-8 rounded-full px-3 text-xs"
                            )}
                            aria-label={`View tenant ${row.tenantName}`}
                          >
                            {landlordPortalId ? "View tenant" : "View"}
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-border px-4 py-3 dark:border-border/80 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
              <p className="text-sm text-muted-foreground">
                {sorted.length === 0
                  ? "Showing 0 of 0"
                  : `Showing ${showingFrom}-${showingTo} of ${sorted.length}`}
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
                  >
                    ›
                  </Button>
                </div>
                <div className="flex h-8 items-center gap-2 rounded-full border border-border bg-background px-2.5 dark:border-border/80">
                  <label htmlFor="pay-page-size" className="whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm">
                    Show
                  </label>
                  <select
                    id="pay-page-size"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="h-7 min-w-[4.5rem] cursor-pointer rounded-full border-0 bg-transparent py-0 pr-6 text-sm font-medium outline-none focus-visible:ring-0"
                  >
                    {PAYMENTS_PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <span className="whitespace-nowrap text-xs text-muted-foreground sm:text-sm">per page</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground lg:text-right">
                Page {safePage} of {totalPages}
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
