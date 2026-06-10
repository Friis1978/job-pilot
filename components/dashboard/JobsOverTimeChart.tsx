"use client";

import {
  AreaChart,
  Area,
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
        {count} {count === 1 ? "job" : "jobs"} found
      </p>
    </div>
  );
}

export function JobsOverTimeChart({ data }: Props) {
  const isEmpty = data.every((d) => d.value === 0);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary mb-5">
        Jobs Found Over Time
      </h2>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-sm font-medium text-text-primary">No data yet</p>
          <p className="text-xs text-text-muted text-center">
            Run a job search to see activity here.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="jobsAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-accent)"
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-accent)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="4 3"
              stroke="var(--color-border)"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              interval={4}
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
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              fill="url(#jobsAreaGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-accent)", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
