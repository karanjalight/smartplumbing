"use client";

import { Check, ChevronDown, Gauge, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchMeterRows,
  formatMeterPickerLabel,
  getMetersForManualTokenPicker,
  type MeterRow,
} from "@/lib/meters-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const DROPDOWN_TRIGGER =
  "flex h-10 w-full items-center justify-between gap-2 rounded-full border border-border bg-background px-3 text-left text-sm dark:border-border/80 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type MeterSearchSelectProps = {
  id?: string;
  label?: string;
  required?: boolean;
  value: string;
  onChange: (meterId: string, meter: MeterRow | null) => void;
  disabled?: boolean;
  description?: string;
};

export function MeterSearchSelect({
  id = "meter-no",
  label = "Meter number",
  required = false,
  value,
  onChange,
  disabled = false,
  description,
}: MeterSearchSelectProps) {
  const [meters, setMeters] = useState<MeterRow[]>([]);
  const [listSource, setListSource] = useState<"loading" | "mock" | "supabase">("loading");
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const loadMeters = useCallback(async () => {
    setListSource("loading");
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) {
      setMeters(getMetersForManualTokenPicker());
      setListSource("mock");
      return;
    }
    try {
      const rows = await fetchMeterRows(supabase);
      setMeters(rows);
      setListSource("supabase");
    } catch {
      setMeters(getMetersForManualTokenPicker());
      setListSource("mock");
    }
  }, []);

  useEffect(() => {
    void loadMeters();
  }, [loadMeters]);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selected = useMemo(
    () => meters.find((m) => m.meterId === value) ?? null,
    [meters, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meters;
    return meters.filter((m) => {
      const label = formatMeterPickerLabel(m).toLowerCase();
      return (
        m.meterId.toLowerCase().includes(q) ||
        m.supplier.toLowerCase().includes(q) ||
        label.includes(q) ||
        (m.tenantName ?? "").toLowerCase().includes(q) ||
        (m.buildingName ?? "").toLowerCase().includes(q) ||
        (m.unitLabel ?? "").toLowerCase().includes(q)
      );
    });
  }, [meters, query]);

  function pick(meter: MeterRow) {
    onChange(meter.meterId, meter);
    setMenuOpen(false);
    setQuery("");
  }

  return (
    <div ref={menuRef} className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <button
        type="button"
        id={id}
        disabled={disabled || listSource === "loading"}
        onClick={() => {
          if (disabled) return;
          setMenuOpen((o) => !o);
          if (!menuOpen) setQuery("");
        }}
        className={cn(DROPDOWN_TRIGGER, disabled && "cursor-not-allowed opacity-60")}
        aria-expanded={menuOpen}
        aria-haspopup="listbox"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Gauge className="size-4 shrink-0 text-muted-foreground" />
          <span className={cn("truncate font-mono text-xs sm:text-sm", !value && "text-muted-foreground")}>
            {value
              ? selected
                ? formatMeterPickerLabel(selected)
                : value
              : listSource === "loading"
                ? "Loading meters…"
                : "Search or select a meter"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            menuOpen && "rotate-180",
          )}
        />
      </button>
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      {listSource === "mock" ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">Meter list from demo data.</p>
      ) : null}
      {menuOpen && (
        <div
          className="relative z-30 overflow-hidden rounded-xl border border-border bg-popover shadow-lg dark:border-border/80"
          role="listbox"
        >
          <div className="border-b border-border p-2 dark:border-border/80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search meter ID, supplier, tenant, site…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-9 rounded-lg pl-8 text-sm"
                autoFocus
              />
            </div>
          </div>
          <ul className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <li className="px-2 py-4 text-center text-sm text-muted-foreground">
                {meters.length === 0
                  ? "No meters in inventory. Onboard a meter first."
                  : "No meters match your search."}
              </li>
            ) : (
              filtered.map((m) => (
                <li key={m.meterId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === m.meterId}
                    className={cn(
                      "flex w-full flex-col gap-0.5 rounded-lg px-2 py-2.5 text-left text-sm hover:bg-muted",
                      value === m.meterId && "bg-muted/80",
                    )}
                    onClick={() => pick(m)}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {value === m.meterId && (
                        <Check className="size-4 shrink-0 text-[#0A4266] dark:text-[#6BB4E8]" />
                      )}
                      <span className={cn("font-mono text-xs", value !== m.meterId && "pl-6")}>
                        {m.meterId}
                      </span>
                      <span className="truncate text-xs font-normal text-muted-foreground">
                        {m.supplier}
                      </span>
                    </span>
                    <span className="pl-6 text-xs text-muted-foreground">
                      {formatMeterPickerLabel(m).split(" · ").slice(1).join(" · ")}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
