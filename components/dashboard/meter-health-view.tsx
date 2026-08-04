"use client";

import { TriangleAlert } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { MeterRelayToggle } from "@/components/meters/meter-relay-toggle";
import { RefreshMeterStatusButton } from "@/components/meters/refresh-meter-status-button";
import {
  fetchMeterRows,
  getMeterRows,
  isElectricityMeter,
  meterTypeLabel,
  type MeterRow,
} from "@/lib/meters-data";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

function needsAttention(row: MeterRow): boolean {
  return (
    row.status === "fault" ||
    row.status === "maintenance" ||
    row.connectivity === "offline" ||
    row.relayState === "disconnected" ||
    row.openAlerts > 0
  );
}

export function MeterHealthView({
  initialRows,
  initialListSource,
}: {
  initialRows: MeterRow[];
  initialListSource: "supabase" | "mock";
}) {
  const pathname = usePathname();
  const [allRows, setAllRows] = useState<MeterRow[]>(initialRows);
  const [listSource, setListSource] = useState<"mock" | "supabase">(initialListSource);

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

  const total = allRows.length;
  const online = allRows.filter((r) => r.connectivity === "online").length;
  const offlineOrUnknown = total - online;
  const electricityOff = allRows.filter(
    (r) => isElectricityMeter(r) && r.relayState === "disconnected"
  ).length;
  const attention = allRows.filter(needsAttention);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Meter Health</h1>
          <p className="mt-1 text-muted-foreground">
            Fleet-wide connectivity and relay/power status, refreshed on demand from LONGi.
          </p>
          {listSource === "mock" ? (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Showing demo data — sign in as admin with Supabase configured for live records.
            </p>
          ) : null}
        </div>
        <RefreshMeterStatusButton
          meterNos={allRows.map((r) => r.meterId)}
          onDone={() => void load()}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-sky-50 p-4 shadow-sm dark:border-border/80 dark:bg-sky-950/30">
          <p className="text-sm font-medium text-muted-foreground">Total meters</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{total}</p>
        </div>
        <div className="rounded-xl border border-border bg-emerald-50 p-4 shadow-sm dark:border-border/80 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-muted-foreground">Online</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{online}</p>
        </div>
        <div className="rounded-xl border border-border bg-violet-50 p-4 shadow-sm dark:border-border/80 dark:bg-violet-950/30">
          <p className="text-sm font-medium text-muted-foreground">Offline / unknown</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{offlineOrUnknown}</p>
        </div>
        <div className="rounded-xl border border-border bg-red-50 p-4 shadow-sm dark:border-border/80 dark:bg-red-950/30">
          <p className="text-sm font-medium text-muted-foreground">Electricity meters currently off</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{electricityOff}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:border-border/80">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 dark:border-border/80">
          <TriangleAlert className="size-4 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="text-sm font-medium text-foreground">
            Needs attention ({attention.length})
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-[#0A4266] text-white dark:bg-[#0d4d73]">
                <th className="px-4 py-3 font-semibold">Meter</th>
                <th className="px-4 py-3 font-semibold">Type</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Building</th>
                <th className="px-4 py-3 font-semibold">Connectivity</th>
                <th className="px-4 py-3 font-semibold">Power</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {attention.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Nothing needs attention right now.
                  </td>
                </tr>
              ) : (
                attention.map((row) => (
                  <tr key={row.meterId} className="bg-card transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {row.meterId}
                    </td>
                    <td className="px-4 py-3 text-foreground">{meterTypeLabel(row.modelType)}</td>
                    <td className="px-4 py-3 text-foreground">{row.tenantName ?? "—"}</td>
                    <td className="px-4 py-3 text-foreground">{row.buildingName ?? "—"}</td>
                    <td className="px-4 py-3 capitalize text-foreground">{row.connectivity}</td>
                    <td className="px-4 py-3 capitalize text-foreground">{row.relayState}</td>
                    <td className="px-4 py-3">
                      {isElectricityMeter(row) ? (
                        <MeterRelayToggle
                          key={`${row.meterId}-${row.relayState}`}
                          meterNo={row.meterId}
                          relayState={row.relayState}
                          onChanged={(next) =>
                            setAllRows((prev) =>
                              prev.map((r) =>
                                r.meterId === row.meterId ? { ...r, relayState: next } : r
                              )
                            )
                          }
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
