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
import type { TokenUsagePoint } from "@/lib/posthog-query";

const PALETTE = [
  "var(--color-accent)",
  "var(--color-info-medium)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-error)",
  "var(--color-info-dark)",
  "var(--color-success-alt)",
  "var(--color-accent-dark)",
  "var(--color-linkedin)",
  "var(--color-info)",
  "var(--color-success-dark)",
];

const FEATURE_LABELS: Record<string, string> = {
  find_jobs: "Find Jobs",
  research_company: "Research",
  tailored_resume: "Tailored Resume",
  tailored_resume_translate: "Translation",
  cover_letter: "Cover Letter",
  tailored_cover_letter: "Tailored Cover Letter",
  cover_letter_advice: "Letter Advice",
  resume_motivation: "Motivation",
  resume_generate: "Resume",
  resume_extract: "Extract Resume",
  import_job: "Import Job",
  regenerate_description: "Regen Description",
  regenerate_summaries: "Regen Summaries",
  linkedin_message: "LinkedIn Message",
  suggest_contact: "Suggest Contact",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

function formatCost(n: number): string {
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(4)}`;
}

type TooltipProps = {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  fmt?: (n: number) => string;
};

function TooltipContent({ active, payload, label, fmt = formatTokens }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].reverse().filter((p) => p.value > 0);
  const total = sorted.reduce((s, p) => s + p.value, 0);
  return (
    <div className="bg-surface border border-border rounded-lg shadow-sm px-3 py-2 flex flex-col gap-1 min-w-36">
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      {sorted.map((p) => (
        <p key={p.name} className="text-xs flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5" style={{ color: p.color }}>
            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: p.color }} />
            {FEATURE_LABELS[p.name] ?? p.name}
          </span>
          <span className="font-semibold text-text-primary">{fmt(p.value)}</span>
        </p>
      ))}
      <p className="text-xs font-semibold text-text-primary border-t border-border pt-1 mt-0.5 flex justify-between">
        <span>Total</span>
        <span>{fmt(total)}</span>
      </p>
    </div>
  );
}

type Props = {
  data: TokenUsagePoint[];
  features: string[];
  totalTokens: number;
  isCost: boolean;
  creditBalance?: number;
};

export function TokenUsageChart({ data, features, totalTokens, isCost, creditBalance }: Props) {
  const isEmpty = totalTokens === 0;
  const formatValue = isCost ? formatCost : formatTokens;
  const unit = isCost ? "cost" : "tokens";

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-start gap-4 mb-5">
        <div className="shrink-0">
          <h2 className="text-base font-semibold text-text-primary">{isCost ? "AI Cost (14 days)" : "Token Usage (14 days)"}</h2>
          {!isEmpty && (
            <p className="text-2xl font-bold text-text-primary mt-0.5">
              {formatValue(totalTokens)}
              <span className="text-sm font-normal text-text-muted ml-1.5">{unit}</span>
            </p>
          )}
        </div>
        {creditBalance !== undefined && (
          <div className="ml-auto text-right shrink-0">
            <p className="text-xs text-text-muted">Balance</p>
            <p className={`text-lg font-bold ${creditBalance < 2 ? "text-error" : "text-text-primary"}`}>
              ${creditBalance.toFixed(2)}
            </p>
          </div>
        )}
        {!isEmpty && (
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1.5 flex-1">
            {features.map((f, i) => (
              <span key={f} className="flex items-center gap-1 text-xs text-text-muted">
                <span
                  className="w-2 h-2 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                />
                {FEATURE_LABELS[f] ?? f}
              </span>
            ))}
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-sm font-medium text-text-primary">No data yet</p>
          <p className="text-xs text-text-muted text-center">
            Token usage will appear here as you use AI features.
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={192}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
            <CartesianGrid strokeDasharray="4 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              interval={4}
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatValue}
              tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              content={(props) => <TooltipContent {...(props as unknown as TooltipProps)} fmt={formatValue} />}
              cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
            />
            {features.map((f, i) => (
              <Area
                key={f}
                type="monotone"
                dataKey={f}
                name={f}
                stackId="1"
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={1.5}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity={0.65}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
