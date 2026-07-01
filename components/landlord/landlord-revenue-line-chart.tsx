"use client";

import { useSyncExternalStore } from "react";
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

import type { MonthlyCollection } from "@/lib/landlord/summary";
import { formatKes } from "@/lib/tenants-data";

const subscribe = () => () => {};

function kesTick(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

export function LandlordRevenueLineChart({ data }: { data: MonthlyCollection[] }) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[260px] min-h-[260px] w-full min-w-0 rounded-md bg-muted/30" aria-hidden />;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm dark:border-border/80 sm:p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Collections over time</h2>
          <p className="text-sm text-muted-foreground">
            M-Pesa and prepaid water revenue by month.
          </p>
        </div>
      </div>
      <div
        className="h-[260px] min-h-[260px] w-full min-w-0"
        role="img"
        aria-label="Line chart of monthly collections in Kenyan shillings"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              axisLine={false} tickLine={false} tickFormatter={kesTick} width={44}
            />
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid var(--border)", background: "var(--card)" }}
              formatter={(value) => {
                const n = typeof value === "number" ? value : Number(value);
                return [formatKes(Number.isFinite(n) ? n : 0), "Collected"];
              }}
              labelFormatter={(label) => `${label}`}
            />
            <Line
              type="monotone" dataKey="amount" stroke="#0A4266" strokeWidth={2.5}
              dot={{ r: 3, fill: "#0A4266", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#0A4266", stroke: "var(--card)", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
