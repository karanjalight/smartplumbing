"use client";

import { useSyncExternalStore } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { PaymentMethodSlice } from "@/lib/dashboard-overview-data";

const METHOD_COLORS: Record<PaymentMethodSlice["name"], string> = {
  "M-Pesa": "#0A4266",
  "Bank": "#6BB4E8",
  "Cash": "#EAB308",
  "STS credit": "#22C55E",
  "Card": "#EC4899",
};

const subscribe = () => () => {};

type PaymentDonutProps = { data: PaymentMethodSlice[] };

export function PaymentDonut({ data }: PaymentDonutProps) {
  const isMounted = useSyncExternalStore(subscribe, () => true, () => false);

  if (!isMounted) {
    return <div className="h-[200px] min-h-[200px] w-full min-w-0 rounded-md bg-muted/30" aria-hidden />;
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[200px] min-h-[200px] w-full min-w-0 items-center justify-center rounded-md bg-muted/30 text-sm text-muted-foreground">
        No payments recorded yet this period.
      </div>
    );
  }

  const chartData = data.map((slice) => ({ ...slice, color: METHOD_COLORS[slice.name] }));
  const summaryLabel = data.map((slice) => `${slice.name} ${slice.pct}%`).join(", ");

  return (
    <div
      className="h-[200px] min-h-[200px] w-full min-w-0"
      role="img"
      aria-label={`Customer payment distribution: ${summaryLabel}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="pct"
            nameKey="name"
          >
            {chartData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => [`${value ?? 0}%`, "Share"]}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--card)",
            }}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            formatter={(value) => {
              const item = chartData.find((d) => d.name === value);
              const pct = item?.pct ?? 0;
              return `${value} (${pct}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
