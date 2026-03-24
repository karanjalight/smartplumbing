"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const DATA = [
  { name: "Cash", value: 45, color: "#0A4266" },
  { name: "Card", value: 30, color: "#EAB308" },
  { name: "Mobile", value: 25, color: "#EC4899" },
];

export function PaymentDonut() {
  return (
    <div
      className="h-[200px] min-h-[200px] w-full min-w-0"
      role="img"
      aria-label="Customer payment distribution: Cash 45%, Card 30%, Mobile 25%"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={DATA}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={70}
            paddingAngle={2}
            dataKey="value"
          >
            {DATA.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
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
              const item = DATA.find((d) => d.name === value);
              const count = item?.value ?? 0;
              return `${value} (${count}%)`;
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
