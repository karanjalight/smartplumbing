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

const DATA = [
  { month: "Jan", value: 30 },
  { month: "Feb", value: 40 },
  { month: "Mar", value: 35 },
  { month: "Apr", value: 50 },
  { month: "May", value: 49 },
  { month: "Jun", value: 60 },
  { month: "Jul", value: 70 },
  { month: "Aug", value: 65 },
  { month: "Sep", value: 75 },
  { month: "Oct", value: 80 },
  { month: "Nov", value: 78 },
  { month: "Dec", value: 85 },
];

const subscribe = () => () => {};

export function RevenueChart() {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[280px] min-h-[280px] w-full min-w-0 rounded-md bg-muted/30" aria-hidden />;
  }

  return (
    <div
      className="h-[280px] min-h-[280px] w-full min-w-0"
      role="img"
      aria-label="Revenue distribution chart by month, ranging from 30% to 85%"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={DATA} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
            formatter={(value) => [`${value ?? 0}%`, "Revenue"]}
            labelFormatter={(label) => `Month: ${label}`}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#0A4266"
            strokeWidth={2}
            fill="url(#revenueGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
