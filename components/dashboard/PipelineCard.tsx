type PipelineData = {
  saved: number;
  applied: number;
  interviewing: number;
  offer: number;
  rejected: number;
  rejected_after_interview: number;
  no_fit: number;
  no_answer: number;
};

const PIPELINE_STEPS: { key: keyof PipelineData; label: string; color: string; bg: string }[] = [
  { key: "offer",                    label: "Offer",                    color: "text-success-foreground", bg: "bg-success" },
  { key: "interviewing",             label: "Interviewing",             color: "text-success",            bg: "bg-success/50" },
  { key: "applied",                  label: "Applied",                  color: "text-warning",            bg: "bg-warning" },
  { key: "rejected",                 label: "Rejected",                 color: "text-error",              bg: "bg-error" },
  { key: "rejected_after_interview", label: "Rej. after interview",     color: "text-error",              bg: "bg-error/70" },
  { key: "saved",                    label: "Saved",                    color: "text-text-secondary",     bg: "bg-text-secondary" },
  { key: "no_answer",                label: "No answer (>14d)",         color: "text-text-muted",         bg: "bg-text-muted/50" },
  { key: "no_fit",                   label: "No fit",                   color: "text-text-muted",         bg: "bg-text-muted" },
];

export function PipelineCard({ data }: { data: PipelineData }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) - data.no_answer;
  const sentTotal = data.applied + data.interviewing + data.rejected + data.rejected_after_interview + data.offer;
  const interviewPct = sentTotal > 0 ? Math.round(((data.interviewing + data.offer + data.rejected_after_interview) / sentTotal) * 100) : null;
  const noAnswerPct = sentTotal > 0 ? Math.round((data.no_answer / sentTotal) * 100) : null;

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-semibold text-text-primary">Application Pipeline</h2>
        <div className="flex items-center gap-3">
          {interviewPct !== null && (
            <span className="text-xs font-medium text-text-muted">
              Interview rate: <span className="text-success font-semibold">{interviewPct}%</span>
            </span>
          )}
          {noAnswerPct !== null && noAnswerPct > 0 && (
            <span className="text-xs font-medium text-text-muted">
              No answer: <span className="text-error font-semibold">{noAnswerPct}%</span>
            </span>
          )}
        </div>
      </div>

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
                <span className={`w-36 shrink-0 text-xs font-medium ${color}`}>
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
