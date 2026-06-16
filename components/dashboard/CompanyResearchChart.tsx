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

export type CompanyResearchPoint = { label: string; search: number; imported: number };

type Props = { data: CompanyResearchPoint[] };

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
        p.value > 0 && (
          <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
            {p.value} {p.value === 1 ? "company" : "companies"} {p.name === "search" ? "from search" : "imported"}
          </p>
        )
      ))}
    </div>
  );
}

export function CompanyResearchChart({ data }: Props) {
  const isEmpty = data.every((d) => d.search === 0 && d.imported === 0);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-text-primary">Company Research Activity</h2>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
            Search
          </span>
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
            Imported
          </span>
        </div>
      </div>

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
            barCategoryGap="25%"
            barGap={2}
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
              dataKey="search"
              name="search"
              fill="var(--color-accent)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="imported"
              name="imported"
              fill="var(--color-success)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
