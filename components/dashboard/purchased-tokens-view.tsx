"use client";

import { Check, ChevronDown, CreditCard, Headphones, MapPin, Search, Smartphone, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  channelLabel,
  fetchTokenPurchaseRows,
  getBasePurchasedTokenRows,
  sourceLabel,
  TOKEN_PURCHASE_PAGE_SIZE_OPTIONS,
  type TokenPurchaseRow,
  type TokenPurchaseSource,
} from "@/lib/tokens-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const SOURCE_OPTIONS: { key: "all" | TokenPurchaseSource; label: string }[] = [
  { key: "all", label: "All sources" },
  { key: "m_pesa", label: "M-Pesa" },
  { key: "app", label: "App" },
  { key: "manual", label: "Manual" },
];

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function PurchasedTokensView() {
  const pathname = usePathname();
  const [rows, setRows] = useState<TokenPurchaseRow[]>([]);
  const [listSource, setListSource] = useState<"loading" | "mock" | "supabase">(
    "loading",
  );

  const load = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setRows(getBasePurchasedTokenRows());
      setListSource("mock");
      return;
    }

    try {
      const data = await fetchTokenPurchaseRows(supabase, { limit: 500 });
      setRows(data);
      setListSource("supabase");
    } catch {
      setRows(getBasePurchasedTokenRows());
      setListSource("mock");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | TokenPurchaseSource>("all");
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const sourceMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(target)) setSourceMenuOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const summary = useMemo(() => {
    const total = rows.length;
    const mpesa = rows.filter((r) => r.source === "m_pesa").length;
    const app = rows.filter((r) => r.source === "app").length;
    const manual = rows.filter((r) => r.source === "manual").length;
    const volume = rows.reduce((s, r) => s + r.amountKes, 0);
    return { total, mpesa, app, manual, volume };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (sourceFilter !== "all" && row.source !== sourceFilter) return false;
      if (!q) return true;
      return (
        row.meterNo.toLowerCase().includes(q) ||
        row.orderNo.toLowerCase().includes(q) ||
        row.tokenFormatted.toLowerCase().includes(q) ||
        (row.tenantName ?? "").toLowerCase().includes(q) ||
        (row.property ?? "").toLowerCase().includes(q) ||
        (row.paymentRef ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);
  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = start + pageRows.length;

  const sourceFilterLabel = SOURCE_OPTIONS.find((o) => o.key === sourceFilter)?.label ?? "All sources";

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0A4266] dark:text-[#6BB4E8]">Tokens</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            All STS token purchases: M-Pesa, tenant app, and admin manual issuances. Use filters to narrow by source.
          </p>
          {listSource === "loading" ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading token ledger…</p>
          ) : listSource === "mock" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Showing demo data — sign in as admin with Supabase configured for live records.
            </p>
          ) : null}
        </div>
        <div
          className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-[#0A4266]/10 dark:bg-[#6BB4E8]/15"
          aria-hidden
        >
          <Ticket className="size-10 text-[#0A4266] dark:text-[#6BB4E8]" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm dark:border-border/80">
        <p className="text-sm text-muted-foreground">
          Issue a token outside normal channels?{" "}
          <Link href="/dashboard/tokens/manual" className="font-medium text-[#0A4266] underline-offset-4 hover:underline dark:text-[#6BB4E8]">
            Manual tokens
          </Link>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total purchases</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Volume {summary.volume.toLocaleString("en-KE")} KES (all rows)
          </p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">M-Pesa</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.mpesa}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">STK / paybill vending</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">App</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.app}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Self-service in app</p>
        </div>
        <div className="rounded-xl border border-border bg-amber-50 p-4 shadow-sm dark:border-border/80 dark:bg-amber-950/30">
          <p className="text-sm font-medium text-muted-foreground">Manual</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{summary.manual}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Office / call / field</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/50 p-4 shadow-sm dark:border-border/80 sm:col-span-2 lg:col-span-1">
          <p className="text-sm font-medium text-muted-foreground">Tip</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            New manual issuances sync from the Manual Tokens page (this browser).
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Purchased tokens</h2>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search meter, order, payment ref, token, tenant…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-10 rounded-full border-border pl-9 dark:border-border/80"
              aria-label="Search token purchases"
            />
          </div>
          <div ref={sourceMenuRef} className="relative w-full min-w-0 lg:max-w-xs">
            <button
              type="button"
              onClick={() => setSourceMenuOpen((o) => !o)}
              className={DROPDOWN_TRIGGER}
              aria-expanded={sourceMenuOpen}
            >
              <span className="flex min-w-0 items-center gap-2">
                <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{sourceFilterLabel}</span>
              </span>
              <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", sourceMenuOpen && "rotate-180")} />
            </button>
            {sourceMenuOpen && (
              <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80">
                <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
                  {SOURCE_OPTIONS.map((o) => (
                    <li key={o.key}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={sourceFilter === o.key}
                        className={cn(
                          "flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted",
                          sourceFilter === o.key && "bg-muted/80"
                        )}
                        onClick={() => {
                          setSourceFilter(o.key);
                          setSourceMenuOpen(false);
                          setPage(1);
                        }}
                      >
                        {sourceFilter === o.key && <Check className="mr-2 inline size-4 text-[#0A4266] dark:text-[#6BB4E8]" />}
                        <span className={sourceFilter !== o.key ? "pl-6" : ""}>{o.label}</span>
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
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead>
                <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Order</th>
                  <th className="px-4 py-3 font-semibold">Meter</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">STS token</th>
                  <th className="px-4 py-3 font-semibold">Tenant / site</th>
                  <th className="px-4 py-3 font-semibold">Payment / detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listSource === "loading" ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      Loading token purchases from Supabase…
                    </td>
                  </tr>
                ) : pageRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                      {rows.length === 0
                        ? "No token purchases yet. Issue one from Manual tokens."
                        : "No rows match your search."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => (
                    <tr key={row.id} className="bg-card transition-colors hover:bg-muted/40">
                      <td className="whitespace-nowrap px-4 py-3 tabular-nums text-muted-foreground">{row.createdAt}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                          {row.source === "m_pesa" ? (
                            <CreditCard className="size-3.5 text-muted-foreground" />
                          ) : row.source === "app" ? (
                            <Smartphone className="size-3.5 text-muted-foreground" />
                          ) : (
                            <Headphones className="size-3.5 text-muted-foreground" />
                          )}
                          {sourceLabel(row.source)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-foreground">{row.orderNo}</td>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">{row.meterNo}</td>
                      <td className="px-4 py-3 tabular-nums text-foreground">{row.amountKes.toLocaleString("en-KE")} KES</td>
                      <td className="max-w-[200px] px-4 py-3">
                        <span className="font-mono text-xs font-medium break-all text-foreground">{row.tokenFormatted}</span>
                      </td>
                      <td className="max-w-[220px] px-4 py-3">
                        {row.tenantName ? (
                          <div className="space-y-0.5">
                            <div className="truncate font-medium text-foreground">{row.tenantName}</div>
                            {row.property ? (
                              <div className="inline-flex items-center gap-1 truncate text-xs text-muted-foreground">
                                <MapPin className="size-3 shrink-0" />
                                {row.property}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="max-w-[220px] px-4 py-3 text-xs text-muted-foreground">
                        {row.source === "m_pesa" && row.paymentRef ? (
                          <span>M-Pesa {row.paymentRef}</span>
                        ) : row.source === "manual" ? (
                          <span>
                            {row.channel ? channelLabel(row.channel) : "—"}
                            {row.note ? ` · ${row.note}` : ""}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
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
                <label htmlFor="purchased-tokens-page-size" className="whitespace-nowrap text-xs font-medium text-muted-foreground sm:text-sm">
                  Show
                </label>
                <select
                  id="purchased-tokens-page-size"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-7 min-w-[4.5rem] cursor-pointer rounded-full border-0 bg-transparent py-0 pr-6 text-sm font-medium outline-none focus-visible:ring-0"
                >
                  {TOKEN_PURCHASE_PAGE_SIZE_OPTIONS.map((n) => (
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
