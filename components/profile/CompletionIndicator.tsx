type Props = {
  percentage: number;
  missingFields: string[];
};

export function CompletionIndicator({ percentage, missingFields }: Props) {
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - percentage / 100);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] flex items-start justify-between gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
            <circle cx="10" cy="10" r="9" stroke="#FF8904" strokeWidth="1.5" />
            <path d="M10 5.5v4.5" stroke="#FF8904" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="10" cy="13.5" r="0.75" fill="#FF8904" />
          </svg>
          <h2 className="text-base font-semibold text-text-primary">Profile needs attention</h2>
        </div>
        <p className="text-sm text-text-secondary mt-1.5 leading-5">
          Complete the missing fields to improve your chance of getting tailored matches and generating quality resumes.
        </p>
        <div className="flex flex-wrap gap-2 mt-3">
          {missingFields.map((field) => (
            <span
              key={field}
              className="text-xs font-semibold uppercase tracking-wide px-3 py-1 rounded-full text-warning"
              style={{ backgroundColor: "rgba(255, 137, 4, 0.1)" }}
            >
              {field}
            </span>
          ))}
        </div>
      </div>

      <div className="shrink-0 relative w-[88px] h-[88px]">
        <svg width="88" height="88" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="#E7EAF3" strokeWidth="9" />
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="#FF8904"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold text-text-primary">
          {percentage}%
        </span>
      </div>
    </div>
  );
}
