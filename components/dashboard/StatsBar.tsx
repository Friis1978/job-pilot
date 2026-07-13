export type StatsData = {
  jobsThisMonth: number;
  jobsLastMonth: number;
  jobsThisWeek: number;
  jobsLastWeek: number;
  avgMatchRate: number;
  avgMatchRateLastWeek: number;
  appliedThisWeek: number;
  appliedLastWeek: number;
  monthTrend: number | null;
  weekTrend: number | null;
  matchRateTrend: number | null;
  appliedTrend: number | null;
};

function TrendBadge({
  value,
  prior,
  priorLabel,
  positiveIsGood = true,
}: {
  value: number;
  prior: number;
  priorLabel: string;
  positiveIsGood?: boolean;
}) {
  const isGood = positiveIsGood ? value > 0 : value < 0;
  const isNeutral = value === 0;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-0.5 rounded-sm text-xs font-medium ${
          isNeutral
            ? "bg-surface-secondary text-text-secondary"
            : isGood
              ? "bg-success-lightest text-success-darker"
              : "bg-error/10 text-error"
        }`}
      >
        {value > 0 ? "+" : ""}{value}%
      </span>
      <span className="text-xs text-text-muted">{prior} {priorLabel}</span>
    </div>
  );
}

export function StatsBar({
  jobsThisMonth,
  jobsLastMonth,
  jobsThisWeek,
  jobsLastWeek,
  avgMatchRate,
  avgMatchRateLastWeek,
  appliedThisWeek,
  appliedLastWeek,
  monthTrend,
  weekTrend,
  matchRateTrend,
  appliedTrend,
}: StatsData) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Jobs found this month</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">{jobsThisMonth}</p>
        <div className="mt-2 h-5 flex items-center">
          {monthTrend !== null ? (
            <TrendBadge value={monthTrend} prior={jobsLastMonth} priorLabel="last month" />
          ) : (
            <span className="text-xs text-text-muted">{jobsLastMonth} last month</span>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Avg. Match Rate</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">
          {jobsThisMonth > 0 ? `${avgMatchRate}%` : "—"}
        </p>
        <div className="mt-2 h-5 flex items-center">
          {matchRateTrend !== null ? (
            <TrendBadge value={matchRateTrend} prior={avgMatchRateLastWeek} priorLabel="% last week" />
          ) : (
            <span className="text-xs text-text-muted">{avgMatchRateLastWeek}% last week</span>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Applied this week</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">{appliedThisWeek}</p>
        <div className="mt-2 h-5 flex items-center">
          {appliedTrend !== null ? (
            <TrendBadge value={appliedTrend} prior={appliedLastWeek} priorLabel="last week" />
          ) : (
            <span className="text-xs text-text-muted">{appliedLastWeek} last week</span>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Jobs this week</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">{jobsThisWeek}</p>
        <div className="mt-2 h-5 flex items-center">
          {weekTrend !== null ? (
            <TrendBadge value={weekTrend} prior={jobsLastWeek} priorLabel="last week" />
          ) : (
            <span className="text-xs text-text-muted">{jobsLastWeek} last week</span>
          )}
        </div>
      </div>
    </div>
  );
}
