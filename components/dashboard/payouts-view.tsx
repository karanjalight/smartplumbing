"use client";

import {
  ArrowDownToLine,
  ArrowUpDown,
  Building2,
  Check,
  ChevronDown,
  Clock,
  Landmark,
  Search,
  Smartphone,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { deletePayout, previewDeletePayout } from "@/app/(dashboard)/dashboard/payouts/actions";
import { useLandlordFinanceStore } from "@/components/landlord/use-landlord-finance-store";
import { DeleteRowButton } from "@/components/dashboard/delete-row-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getLandlordRows } from "@/lib/landlords-data";
import { appendPayoutAdded, mergePayoutLedgerForLandlord } from "@/lib/landlord-finance-storage";
import {
  buildPayoutLedger,
  PLATFORM_FEE_RATE,
  PAYOUT_PAGE_SIZE_OPTIONS,
  railLabel,
  suggestedNetForLandlord,
  type PayoutLedgerRow,
  type PayoutRail,
} from "@/lib/payouts-data";
import { cn } from "@/lib/utils";

const DEMO_ANCHOR = new Date("2026-04-05T12:00:00.000Z");

const PERIOD_FILTER = [
  { key: "all" as const, label: "All periods" },
  { key: "30d" as const, label: "Last 30 days" },
  { key: "90d" as const, label: "Last 90 days" },
];

const STATUS_OPTIONS: { key: "all" | PayoutLedgerRow["status"]; label: string }[] = [
  { key: "all", label: "All statuses" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "failed", label: "Failed" },
];

const RAIL_OPTIONS: { key: "all" | PayoutRail; label: string }[] = [
  { key: "all", label: "All rails" },
  { key: "m_pesa_b2b", label: "M-Pesa B2B" },
  { key: "bank_transfer", label: "Bank transfer" },
];

export type PayoutSortKey = "date_desc" | "date_asc" | "net_desc" | "net_asc";

const SORT_OPTIONS: { key: PayoutSortKey; label: string; hint: string }[] = [
  { key: "date_desc", label: "Newest scheduled", hint: "Settlement batch time" },
  { key: "date_asc", label: "Oldest scheduled", hint: "Settlement batch time" },
  { key: "net_desc", label: "Net high → low", hint: "To landlord" },
  { key: "net_asc", label: "Net low → high", hint: "To landlord" },
];

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function payoutStatusBadge(status: PayoutLedgerRow["status"]) {
  const map = {
    completed:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    pending: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
    failed: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", map[status])}>
      {status}
    </span>
  );
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function periodCutoff(key: (typeof PERIOD_FILTER)[number]["key"]): Date | null {
  if (key === "all") return null;
  const days = key === "30d" ? 30 : 90;
  const d = new Date(DEMO_ANCHOR);
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export type PayoutsViewProps = {
  /** When set, ledger is scoped to this landlord (landlord portal). */
  landlordPortalId?: string;
};

export function PayoutsView({ landlordPortalId }: PayoutsViewProps) {
  const financeStore = useLandlordFinanceStore();
  const [adminRows, setAdminRows] = useState<PayoutLedgerRow[]>(() => buildPayoutLedger());

  const rows = useMemo(() => {
    if (landlordPortalId && financeStore) {
      return mergePayoutLedgerForLandlord(landlordPortalId, financeStore);
    }
    return adminRows;
  }, [landlordPortalId, financeStore, adminRows]);

  const [search, setSearch] = useState("");
  const [periodKey, setPeriodKey] = useState<(typeof PERIOD_FILTER)[number]["key"]>("90d");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]["key"]>("all");
  const [railFilter, setRailFilter] = useState<(typeof RAIL_OPTIONS)[number]["key"]>("all");
  const [landlordFilter, setLandlordFilter] = useState<string>(() => landlordPortalId ?? "all");
  const [sortKey, setSortKey] = useState<PayoutSortKey>("date_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(16);

  const [periodOpen, setPeriodOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [landlordOpen, setLandlordOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const landlordRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const landlordOptions = useMemo(() => getLandlordRows(), []);

  const [queueLandlordId, setQueueLandlordId] = useState(() => {
    const landlords = getLandlordRows();
    const first = landlords.find((l) => l.status === "active") ?? landlords[0];
    return first?.id ?? "";
  });
  const [queueNetKes, setQueueNetKes] = useState(() => {
    const landlords = getLandlordRows();
    const first = landlords.find((l) => l.status === "active") ?? landlords[0];
    return first ? String(suggestedNetForLandlord(first)) : "";
  });
  const [queueRail, setQueueRail] = useState<PayoutRail>("m_pesa_b2b");
  const [queueLoading, setQueueLoading] = useState(false);

  useEffect(() => {
    if (!landlordPortalId || !landlordOptions.length) return;
    const l = landlordOptions.find((x) => x.id === landlordPortalId);
    if (l) {
      setQueueLandlordId(landlordPortalId);
      setQueueNetKes(String(suggestedNetForLandlord(l)));
    }
  }, [landlordPortalId, landlordOptions]);

  useEffect(() => {
    function closeAll(e: PointerEvent) {
      const t = e.target as Node;
      if (periodRef.current && !periodRef.current.contains(t)) setPeriodOpen(false);
      if (statusRef.current && !statusRef.current.contains(t)) setStatusOpen(false);
      if (railRef.current && !railRef.current.contains(t)) setRailOpen(false);
      if (landlordRef.current && !landlordRef.current.contains(t)) setLandlordOpen(false);
      if (sortRef.current && !sortRef.current.contains(t)) setSortOpen(false);
    }
    document.addEventListener("pointerdown", closeAll);
    return () => document.removeEventListener("pointerdown", closeAll);
  }, []);

  const filtered = useMemo(() => {
    const cutoff = periodCutoff(periodKey);
    const q = search.trim().toLowerCase();
    const scopeId = landlordPortalId ?? null;
    return rows.filter((r) => {
      if (scopeId && r.landlordId !== scopeId) return false;
      if (cutoff && new Date(r.scheduledAtIso) < cutoff) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (railFilter !== "all" && r.rail !== railFilter) return false;
      if (!landlordPortalId && landlordFilter !== "all" && r.landlordId !== landlordFilter) return false;
      if (!q) return true;
      return (
        r.reference.toLowerCase().includes(q) ||
        r.company.toLowerCase().includes(q) ||
        r.landlordName.toLowerCase().includes(q) ||
        r.landlordId.toLowerCase().includes(q) ||
        r.periodLabel.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q)
      );
    });
  }, [rows, search, periodKey, statusFilter, railFilter, landlordFilter, landlordPortalId]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      switch (sortKey) {
        case "date_desc":
          return b.scheduledAtIso.localeCompare(a.scheduledAtIso);
        case "date_asc":
          return a.scheduledAtIso.localeCompare(b.scheduledAtIso);
        case "net_desc":
          return b.netPayoutKes - a.netPayoutKes;
        case "net_asc":
          return a.netPayoutKes - b.netPayoutKes;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey]);

  const summary = useMemo(() => {
    const completed = filtered.filter((r) => r.status === "completed");
    const pending = filtered.filter((r) => r.status === "pending");
    const failed = filtered.filter((r) => r.status === "failed");
    const netPaid = completed.reduce((s, r) => s + r.netPayoutKes, 0);
    const pendingKes = pending.reduce((s, r) => s + r.netPayoutKes, 0);
    return {
      netPaid,
      pendingKes,
      pendingCount: pending.length,
      failedCount: failed.length,
      rowCount: filtered.length,
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
      "Landlord ID",
      "Company",
      "Period",
      "Gross (KES)",
      "Platform fee (KES)",
      "Net payout (KES)",
      "Rail",
      "Status",
      "Scheduled (UTC)",
      "Paid (UTC)",
    ];
    const lines = [
      headers.join(","),
      ...sorted.map((r) =>
        [
          `"${r.reference.replace(/"/g, '""')}"`,
          r.landlordId,
          `"${r.company.replace(/"/g, '""')}"`,
          `"${r.periodLabel}"`,
          r.grossKes,
          r.platformFeeKes,
          r.netPayoutKes,
          railLabel(r.rail),
          r.status,
          `"${r.scheduledAtIso}"`,
          r.paidAtIso ? `"${r.paidAtIso}"` : "",
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${landlordPortalId ? "my-payouts" : "landlord-payouts"}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Export ready", { description: `${sorted.length} row(s).` });
  }

  async function queuePayout(e: React.FormEvent) {
    e.preventDefault();
    const effectiveLandlordId = landlordPortalId ?? queueLandlordId;
    const l = landlordOptions.find((x) => x.id === effectiveLandlordId);
    if (!l) {
      toast.error("Select a landlord.");
      return;
    }
    const net = Math.round(Number(queueNetKes.replace(/,/g, "")));
    if (!Number.isFinite(net) || net < 500) {
      toast.error("Net payout must be at least KES 500.");
      return;
    }
    const gross = Math.round(net / (1 - PLATFORM_FEE_RATE));
    const fee = Math.max(0, gross - net);
    setQueueLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    const scheduledAtIso = DEMO_ANCHOR.toISOString();
    const row: PayoutLedgerRow = {
      id: `POT-QUEUE-${Date.now()}`,
      landlordId: l.id,
      landlordName: l.name,
      company: l.company,
      region: l.region,
      periodLabel: `Apr 2026 (manual queue)`,
      grossKes: gross,
      platformFeeKes: fee,
      netPayoutKes: net,
      rail: queueRail,
      status: "pending",
      reference: queueRail === "m_pesa_b2b" ? `MPE-B2B-Q${Date.now().toString(36).toUpperCase()}` : `BK-OUT-Q${Date.now().toString(36).toUpperCase()}`,
      scheduledAtIso,
      paidAtIso: null,
    };
    if (landlordPortalId) {
      appendPayoutAdded(row);
    } else {
      setAdminRows((prev) => [row, ...prev]);
    }
    setQueueLoading(false);
    toast.success("Payout queued", {
      description: `${l.company} — ${net.toLocaleString("en-KE")} KES net (pending settlement).`,
    });
    setPage(1);
  }

  const periodLabel = PERIOD_FILTER.find((o) => o.key === periodKey)?.label ?? "Period";
  const statusLabel = STATUS_OPTIONS.find((o) => o.key === statusFilter)?.label ?? "Status";
  const railLabelSel = RAIL_OPTIONS.find((o) => o.key === railFilter)?.label ?? "Rail";
  const landlordLabel =
    landlordFilter === "all"
      ? "All landlords"
      : landlordOptions.find((l) => l.id === landlordFilter)?.company ?? "Landlord";
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sortKey)?.label ?? "Sort";

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">
            {landlordPortalId ? "Your payouts" : "Payouts to landlords"}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {landlordPortalId
              ? "Settlement batches from water revenue collected on the platform. Open a row to see which tenant payments were attributed to that period."
              : "Revenue collected on the platform is settled to landlords on a schedule. This ledger is for finance reconciliation."}
          </p>
        </div>
        <div
          className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15"
          aria-hidden
        >
          <Wallet className="size-10 text-[#0A4266] dark:text-[#6BB4E8]" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Net paid (in view)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {summary.netPaid.toLocaleString("en-KE")} <span className="text-lg font-semibold">KES</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Completed rows after filters</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">Pending settlement</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {summary.pendingKes.toLocaleString("en-KE")} <span className="text-lg font-semibold">KES</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{summary.pendingCount} batch(es)</p>
        </div>
        <div className="rounded-xl border border-border bg-red-50 p-4 shadow-sm dark:border-border/80 dark:bg-red-950/25">
          <p className="text-sm font-medium text-muted-foreground">Failed / reversed</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.failedCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Needs operator follow-up</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">Rows in view</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.rowCount}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Search & filters applied</p>
        </div>
      </div>
 

      <div className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={
                landlordPortalId
                  ? "Search reference, period, amount…"
                  : "Search reference, landlord, company, period…"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-full border-border pl-9 dark:border-border/80"
              aria-label="Search payouts"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-full gap-2"
            disabled={sorted.length === 0}
            onClick={() => void exportCsv()}
          >
            <ArrowDownToLine className="size-4" />
            Export CSV
          </Button>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap">
          <div ref={periodRef} className="relative min-w-[180px] flex-1 lg:max-w-[200px]">
            <button type="button" onClick={() => setPeriodOpen((o) => !o)} className={DROPDOWN_TRIGGER} aria-expanded={periodOpen}>
              <span className="truncate">{periodLabel}</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", periodOpen && "rotate-180")} />
            </button>
            {periodOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                <ul className="p-1" role="listbox">
                  {PERIOD_FILTER.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                          periodKey === o.key && "bg-muted/80"
                        )}
                        onClick={() => {
                          setPeriodKey(o.key);
                          setPeriodOpen(false);
                          setPage(1);
                        }}
                      >
                        {periodKey === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                        <span className={periodKey !== o.key ? "pl-6" : ""}>{o.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div ref={statusRef} className="relative min-w-[180px] flex-1 lg:max-w-[200px]">
            <button type="button" onClick={() => setStatusOpen((o) => !o)} className={DROPDOWN_TRIGGER} aria-expanded={statusOpen}>
              <span className="truncate">{statusLabel}</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", statusOpen && "rotate-180")} />
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
          <div ref={railRef} className="relative min-w-[180px] flex-1 lg:max-w-[200px]">
            <button type="button" onClick={() => setRailOpen((o) => !o)} className={DROPDOWN_TRIGGER} aria-expanded={railOpen}>
              <span className="truncate">{railLabelSel}</span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", railOpen && "rotate-180")} />
            </button>
            {railOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                <ul className="p-1" role="listbox">
                  {RAIL_OPTIONS.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                          railFilter === o.key && "bg-muted/80"
                        )}
                        onClick={() => {
                          setRailFilter(o.key);
                          setRailOpen(false);
                          setPage(1);
                        }}
                      >
                        {railFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                        <span className={railFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {!landlordPortalId && (
            <div ref={landlordRef} className="relative min-w-[200px] flex-1 lg:max-w-[260px]">
              <button
                type="button"
                onClick={() => setLandlordOpen((o) => !o)}
                className={DROPDOWN_TRIGGER}
                aria-expanded={landlordOpen}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{landlordLabel}</span>
                </span>
                <ChevronDown className={cn("size-4 shrink-0 transition-transform", landlordOpen && "rotate-180")} />
              </button>
              {landlordOpen && (
                <div className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                  <ul className="p-1" role="listbox">
                    <li>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                          landlordFilter === "all" && "bg-muted/80"
                        )}
                        onClick={() => {
                          setLandlordFilter("all");
                          setLandlordOpen(false);
                          setPage(1);
                        }}
                      >
                        {landlordFilter === "all" && <Check className="mr-2 inline size-4" />}
                        <span className={landlordFilter !== "all" ? "pl-6" : ""}>All landlords</span>
                      </button>
                    </li>
                    {landlordOptions.map((l) => (
                      <li key={l.id}>
                        <button
                          type="button"
                          className={cn(
                            "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                            landlordFilter === l.id && "bg-muted/80"
                          )}
                          onClick={() => {
                            setLandlordFilter(l.id);
                            setLandlordOpen(false);
                            setPage(1);
                          }}
                        >
                          {landlordFilter === l.id && <Check className="mr-2 inline size-4" />}
                          <span className={landlordFilter !== l.id ? "pl-6" : ""}>{l.company}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div ref={sortRef} className="relative min-w-[200px] flex-1 lg:max-w-[280px]">
            <button type="button" onClick={() => setSortOpen((o) => !o)} className={DROPDOWN_TRIGGER} aria-expanded={sortOpen}>
              <span className="flex min-w-0 items-center gap-2">
                <ArrowUpDown className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{sortLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 transition-transform", sortOpen && "rotate-180")} />
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
            <table
              className={cn(
                "w-full text-left text-sm",
                landlordPortalId ? "min-w-[960px]" : "min-w-[1200px]"
              )}
            >
              <thead>
                <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  {!landlordPortalId && <th className="px-4 py-3 font-semibold">Landlord</th>}
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold">Gross</th>
                  <th className="px-4 py-3 font-semibold">Fee</th>
                  <th className="px-4 py-3 font-semibold">Net payout</th>
                  <th className="px-4 py-3 font-semibold">Rail</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Scheduled</th>
                  <th className="px-4 py-3 font-semibold">Paid</th>
                  {!landlordPortalId && (
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  )}
                  {landlordPortalId && (
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={landlordPortalId ? 10 : 11}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      No payouts match your filters.
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id} className="bg-card transition-colors hover:bg-muted/40">
                      <td className="max-w-[200px] px-4 py-3">
                        <span className="font-mono text-xs break-all text-foreground">{row.reference}</span>
                      </td>
                      {!landlordPortalId && (
                        <td className="max-w-[220px] px-4 py-3">
                          <div className="font-medium text-foreground">{row.company}</div>
                          <div className="text-xs text-muted-foreground">{row.region}</div>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 text-foreground">{row.periodLabel}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.grossKes.toLocaleString("en-KE")}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{row.platformFeeKes.toLocaleString("en-KE")}</td>
                      <td className="px-4 py-3 tabular-nums font-medium text-foreground">
                        {row.netPayoutKes.toLocaleString("en-KE")} KES
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-foreground">
                          {row.rail === "m_pesa_b2b" ? (
                            <Smartphone className="size-3.5 text-muted-foreground" aria-hidden />
                          ) : (
                            <Landmark className="size-3.5 text-muted-foreground" aria-hidden />
                          )}
                          {railLabel(row.rail)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{payoutStatusBadge(row.status)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatWhen(row.scheduledAtIso)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatWhen(row.paidAtIso)}</td>
                      {!landlordPortalId && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/dashboard/landlords/${encodeURIComponent(row.landlordId)}`}
                              className={cn(
                                buttonVariants({ variant: "outline", size: "sm" }),
                                "inline-flex h-8 rounded-full px-3 text-xs"
                              )}
                              aria-label={`View landlord ${row.company}`}
                            >
                              View
                            </Link>
                            <DeleteRowButton
                              preview={() => previewDeletePayout(row.id)}
                              onDelete={() => deletePayout(row.id)}
                              title="Delete payout?"
                              description={`Payout ${row.reference} will be deleted. Linked payments are kept.`}
                              successMessage="Payout deleted"
                              onDeleted={() => setAdminRows((prev) => prev.filter((r) => r.id !== row.id))}
                            />
                          </div>
                        </td>
                      )}
                      {landlordPortalId && (
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/landlords/dashboard/finance/payouts/${encodeURIComponent(row.id)}`}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "inline-flex h-8 rounded-full px-3 text-xs"
                            )}
                            aria-label={`View payout breakdown ${row.reference}`}
                          >
                            View breakdown
                          </Link>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-border px-4 py-3 dark:border-border/80 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">
              {sorted.length === 0 ? "Showing 0 of 0" : `Showing ${showingFrom}-${showingTo} of ${sorted.length}`}
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
                <label htmlFor="payout-page-size" className="whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm">
                  Show
                </label>
                <select
                  id="payout-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 min-w-[4.5rem] cursor-pointer rounded-full border-0 bg-transparent py-0 pr-6 text-sm font-medium outline-none focus-visible:ring-0"
                >
                  {PAYOUT_PAGE_SIZE_OPTIONS.map((n) => (
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
  );
}
