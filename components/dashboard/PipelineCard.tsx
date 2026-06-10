type PipelineData = {
  saved: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
};

const PIPELINE_STEPS: { key: keyof PipelineData; label: string; color: string; bg: string }[] = [
  { key: "saved",        label: "Saved",        color: "text-text-secondary",   bg: "bg-border" },
  { key: "applied",      label: "Applied",      color: "text-info-foreground",  bg: "bg-info" },
  { key: "interviewing", label: "Interviewing", color: "text-accent",           bg: "bg-accent" },
  { key: "offer",        label: "Offer",        color: "text-success-foreground", bg: "bg-success" },
  { key: "rejected",     label: "Rejected",     color: "text-error",            bg: "bg-error" },
];

export function PipelineCard({ data }: { data: PipelineData }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary mb-5">
        Application Pipeline
      </h2>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-sm font-medium text-text-primary">No applications yet</p>
          <p className="text-xs text-text-muted text-center">
            Update job statuses to track your pipeline here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {PIPELINE_STEPS.map(({ key, label, color, bg }) => {
            const count = data[key];
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-3">
                <span className={`w-24 shrink-0 text-xs font-medium ${color}`}>
                  {label}
                </span>
                <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                  {count > 0 && (
                    <div
                      className={`h-full rounded-full ${bg}`}
                      style={{ width: `${pct}%` }}
                    />
                  )}
                </div>
                <span className="w-6 shrink-0 text-xs font-semibold text-text-primary tabular-nums text-right">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
