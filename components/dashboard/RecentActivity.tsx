export type ActivityItem = {
  type: "job_found" | "researched";
  text: string;
  time: string;
};

type Props = {
  activities: ActivityItem[];
};

function ActivityDot({ type }: { type: ActivityItem["type"] }) {
  const isJobFound = type === "job_found";
  return (
    <div className="relative shrink-0 flex items-center justify-center w-4 h-4">
      <div
        className={`absolute inset-0 rounded-full ${isJobFound ? "bg-success-light" : "bg-info-light"}`}
      />
      <div
        className={`relative w-2 h-2 rounded-full ${isJobFound ? "bg-success-alt" : "bg-info"}`}
      />
    </div>
  );
}

export function RecentActivity({ activities }: Props) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <h2 className="text-base font-semibold text-text-primary mb-5">
        Recent Activity
      </h2>

      {activities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <p className="text-sm font-medium text-text-primary">No activity yet</p>
          <p className="text-xs text-text-muted text-center">
            Run a job search to see activity here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {activities.map((item, i) => {
            const isLast = i === activities.length - 1;
            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <ActivityDot type={item.type} />
                  {!isLast && (
                    <div
                      className="w-px flex-1 my-1 bg-border"
                      style={{ minHeight: "24px" }}
                    />
                  )}
                </div>
                <div className={`min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                  <p className="text-sm font-medium text-text-primary leading-snug">
                    {item.text}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">{item.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
