"use client";

import {
  AlertTriangle,
  Bell,
  BellOff,
  CreditCard,
  Gauge,
  Info,
  Search,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useLandlordFinanceStore } from "@/components/landlord/use-landlord-finance-store";
import { useLandlordPortfolioStore } from "@/components/landlord/use-landlord-portfolio-store";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildLandlordAlerts, type LandlordAlert, type LandlordAlertSeverity } from "@/lib/landlord-alerts-data";
import {
  dismissAlertId,
  readDismissedAlertIds,
  restoreDismissedAlertIds,
  subscribeLandlordAlertDismiss,
} from "@/lib/landlord-alerts-dismiss-storage";
import { cn } from "@/lib/utils";

const SEVERITY_FILTER: { key: "all" | LandlordAlertSeverity; label: string }[] = [
  { key: "all", label: "All" },
  { key: "critical", label: "Critical" },
  { key: "warning", label: "Warning" },
  { key: "info", label: "Info" },
];

const CATEGORY_FILTER: { key: "all" | LandlordAlert["category"]; label: string }[] = [
  { key: "all", label: "All types" },
  { key: "meter", label: "Meters" },
  { key: "tenant", label: "Tenants" },
  { key: "payment", label: "Payments" },
  { key: "system", label: "System" },
];

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function severityBadge(sev: LandlordAlertSeverity) {
  const map = {
    critical:
      "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
    warning:
      "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    info: "bg-sky-100 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  };
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize", map[sev])}>
      {sev}
    </span>
  );
}

function CategoryIcon({ c }: { c: LandlordAlert["category"] }) {
  if (c === "meter") return <Gauge className="size-4 text-muted-foreground" aria-hidden />;
  if (c === "tenant") return <UserRound className="size-4 text-muted-foreground" aria-hidden />;
  if (c === "payment") return <CreditCard className="size-4 text-muted-foreground" aria-hidden />;
  return <Info className="size-4 text-muted-foreground" aria-hidden />;
}

export function LandlordAlertsView({ landlordId }: { landlordId: string }) {
  const portfolio = useLandlordPortfolioStore();
  const finance = useLandlordFinanceStore();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState<(typeof SEVERITY_FILTER)[number]["key"]>("all");
  const [category, setCategory] = useState<(typeof CATEGORY_FILTER)[number]["key"]>("all");

  useEffect(() => {
    setDismissed(readDismissedAlertIds());
    return subscribeLandlordAlertDismiss(() => setDismissed([...readDismissedAlertIds()]));
  }, []);

  const allAlerts = useMemo(() => {
    if (!portfolio || !finance) return [];
    return buildLandlordAlerts(landlordId, portfolio, finance);
  }, [landlordId, portfolio, finance]);

  const dismissedSet = useMemo(() => new Set(dismissed), [dismissed]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allAlerts.filter((a) => {
      if (dismissedSet.has(a.id)) return false;
      if (severity !== "all" && a.severity !== severity) return false;
      if (category !== "all" && a.category !== category) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.includes(q)
      );
    });
  }, [allAlerts, dismissedSet, search, severity, category]);

  const summary = useMemo(() => {
    const open = allAlerts.filter((a) => !dismissedSet.has(a.id));
    return {
      total: allAlerts.length,
      open: open.length,
      dismissed: dismissedSet.size,
      critical: open.filter((a) => a.severity === "critical").length,
      warning: open.filter((a) => a.severity === "warning").length,
      info: open.filter((a) => a.severity === "info").length,
    };
  }, [allAlerts, dismissedSet]);

  function onDismiss(id: string) {
    dismissAlertId(id);
    toast.success("Alert dismissed");
  }

  function onRestoreAll() {
    if (!confirm("Show all dismissed alerts again?")) return;
    restoreDismissedAlertIds();
    toast.success("Dismissed alerts restored");
  }

  if (portfolio === null || finance === null) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading alerts…</div>;
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[#0A4266] dark:text-[#6BB4E8]">
            <AlertTriangle className="size-8" />
            <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Issues surfaced from your meters, tenants, and payment ledger (including records you add under Finance).
            Dismissing an alert hides it on this device until you restore.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="shrink-0 rounded-full gap-2"
          onClick={onRestoreAll}
          disabled={dismissed.length === 0}
        >
          <BellOff className="size-4" />
          Restore dismissed
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">Open alerts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.open}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">of {summary.total} generated</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 shadow-sm dark:border-red-900/40 dark:bg-red-950/25">
          <p className="text-xs font-medium text-red-900 dark:text-red-200">Critical</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.critical}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/25">
          <p className="text-xs font-medium text-amber-900 dark:text-amber-200">Warning</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.warning}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm dark:border-sky-900/40 dark:bg-sky-950/25">
          <p className="text-xs font-medium text-sky-900 dark:text-sky-200">Info</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{summary.info}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title or description…"
            className="h-10 rounded-full border-border pl-9 dark:border-border/80"
            aria-label="Search alerts"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as (typeof SEVERITY_FILTER)[number]["key"])}
            className="h-10 min-w-[140px] rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
            aria-label="Filter by severity"
          >
            {SEVERITY_FILTER.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORY_FILTER)[number]["key"])}
            className="h-10 min-w-[160px] rounded-full border border-border bg-background px-3 text-sm dark:border-border/80"
            aria-label="Filter by type"
          >
            {CATEGORY_FILTER.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="border-b border-border px-4 py-3 dark:border-border/80">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Bell className="size-4 text-[#0A4266] dark:text-[#6BB4E8]" aria-hidden />
            Active alerts
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Alert</th>
                <th className="px-4 py-3 font-semibold">When</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center text-muted-foreground">
                    {summary.open === 0 && allAlerts.length > 0
                      ? "All alerts are dismissed — use Restore dismissed to show them again."
                      : "No alerts match your filters."}
                  </td>
                </tr>
              ) : (
                visible.map((a) => (
                  <tr key={a.id} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 capitalize text-muted-foreground">
                        <CategoryIcon c={a.category} />
                        {a.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">{severityBadge(a.severity)}</td>
                    <td className="max-w-[420px] px-4 py-3">
                      <p className="font-medium text-foreground">{a.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{formatWhen(a.createdAtIso)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {a.href && (
                          <Link
                            href={a.href}
                            className={cn(
                              buttonVariants({ variant: "outline", size: "sm" }),
                              "h-8 rounded-full px-3 text-xs"
                            )}
                          >
                            Open
                          </Link>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full text-muted-foreground hover:text-foreground"
                          aria-label="Dismiss alert"
                          onClick={() => onDismiss(a.id)}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
