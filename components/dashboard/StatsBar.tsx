export type StatsData = {
  totalJobs: number;
  avgMatchRate: number;
  companiesResearched: number;
  jobsThisWeek: number;
  totalJobsTrend: number | null;   // percentage change vs last 7 days, null = no prior data
  matchRateTrend: number | null;
};

function TrendBadge({ value }: { value: number }) {
  const isPositive = value > 0;
  const label = `${isPositive ? "+" : ""}${value}%`;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`px-2 py-0.5 rounded-sm text-xs font-medium ${
          isPositive
            ? "bg-success-lightest text-success-darker"
            : "bg-surface-secondary text-text-secondary"
        }`}
      >
        {label}
      </span>
      <span className="text-xs text-text-muted">vs last week</span>
    </div>
  );
}

export function StatsBar({
  totalJobs,
  avgMatchRate,
  companiesResearched,
  jobsThisWeek,
  totalJobsTrend,
  matchRateTrend,
}: StatsData) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Total Jobs Found</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">{totalJobs}</p>
        <div className="mt-2 h-5 flex items-center">
          {totalJobsTrend !== null ? (
            <TrendBadge value={totalJobsTrend} />
          ) : (
            <span className="text-xs text-text-muted">vs last week</span>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Avg. Match Rate</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">
          {totalJobs > 0 ? `${avgMatchRate}%` : "—"}
        </p>
        <div className="mt-2 h-5 flex items-center">
          {matchRateTrend !== null ? (
            <TrendBadge value={matchRateTrend} />
          ) : (
            <span className="text-xs text-text-muted">vs last week</span>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Companies Researched</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">{companiesResearched}</p>
        <div className="mt-2 h-5 flex items-center">
          <span className="text-xs text-text-muted">Total researched</span>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
        <p className="text-sm font-medium text-text-secondary">Jobs This Week</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary">{jobsThisWeek}</p>
        <div className="mt-2 h-5 flex items-center">
          <span className="text-xs text-text-muted">New this week</span>
        </div>
      </div>
    </div>
  );
}
