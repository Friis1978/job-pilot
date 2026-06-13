"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { JobsOverTimePoint } from "@/lib/posthog-query";

type Props = { data: JobsOverTimePoint[] };

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
};

function TooltipContent({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 flex flex-col gap-1">
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.value} {p.name === "search" ? "from search" : "imported"}
        </p>
      ))}
    </div>
  );
}

export function JobsOverTimeChart({ data }: Props) {
  const isEmpty = data.every((d) => d.search === 0 && d.imported === 0);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-text-primary">Jobs Found Over Time</h2>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
            Search
          </span>
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: "var(--color-success)" }} />
            Imported
          </span>
        </div>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-sm font-medium text-text-primary">No data yet</p>
          <p className="text-xs text-text-muted text-center">
            Run a job search or import a job URL to see activity here.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <defs>
              <linearGradient id="searchGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="importedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.02} />
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
              dataKey="search"
              name="search"
              stroke="var(--color-accent)"
              strokeWidth={2.5}
              fill="url(#searchGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-accent)", strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="imported"
              name="imported"
              stroke="var(--color-success)"
              strokeWidth={2.5}
              fill="url(#importedGradient)"
              dot={false}
              activeDot={{ r: 4, fill: "var(--color-success)", strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
