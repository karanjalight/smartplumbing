"use client";

import { useSyncExternalStore } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { MonthlyRevenuePoint } from "@/lib/dashboard-overview-data";
import { formatKes } from "@/lib/tenants-data";

const subscribe = () => () => {};

const compactKes = new Intl.NumberFormat("en-KE", { notation: "compact" });

type RevenueChartProps = { data: MonthlyRevenuePoint[] };

export function RevenueChart({ data }: RevenueChartProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[280px] min-h-[280px] w-full min-w-0 rounded-md bg-muted/30" aria-hidden />;
  }

  const rangeLabel =
    data.length > 0 ? `${data[0].month}–${data[data.length - 1].month}` : "this year";

  return (
    <div
      className="h-[280px] min-h-[280px] w-full min-w-0"
      role="img"
      aria-label={`Revenue distribution chart by month (${rangeLabel}), in KES`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0A4266" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#0A4266" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
            axisLine={false}
            tickFormatter={(v) => `KES ${compactKes.format(v)}`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
            formatter={(value) => [formatKes(Number(value) || 0), "Revenue"]}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="kes"
            stroke="#0A4266"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
