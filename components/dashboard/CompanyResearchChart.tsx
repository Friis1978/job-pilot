"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ChartPoint } from "@/lib/posthog-query";

type Props = { data: ChartPoint[] };

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
};

function TooltipContent({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const count = payload[0].value;
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2">
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-text-primary">
        {count} {count === 1 ? "company" : "companies"} researched
      </p>
    </div>
  );
}

export function CompanyResearchChart({ data }: Props) {
  const isEmpty = data.every((d) => d.value === 0);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary mb-5">
        Company Research Activity
      </h2>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-sm font-medium text-text-primary">No data yet</p>
          <p className="text-xs text-text-muted text-center">
            Research a company to see activity here.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={172}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="4 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={(props) => <TooltipContent {...(props as unknown as TooltipProps)} />}
              cursor={{ fill: "var(--color-surface-secondary)" }}
            />
            <Bar
              dataKey="value"
              fill="var(--color-info)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
