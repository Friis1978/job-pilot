import type { Connection } from "@/types";
import { calculateOpportunityScore, isRecruiter } from "@/lib/network-utils";

type Props = {
  matchScore: number;
  connections: Connection[];
};

export function OpportunityScore({ matchScore, connections }: Props) {
  const score = calculateOpportunityScore(matchScore, connections);
  const bonus = score - matchScore;
  const hasRecruiter = connections.some(isRecruiter);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <p className="text-sm font-medium text-text-secondary mb-3">Opportunity Score</p>

      <div className="flex items-end gap-3 mb-4">
        <span className="text-4xl font-semibold text-text-primary">{score}</span>
        <span className="text-sm text-text-muted mb-1">/ 100</span>
        {bonus > 0 && (
          <span className="text-sm font-medium text-success mb-1">+{bonus} network bonus</span>
        )}
      </div>

      <div className="w-full bg-surface-tertiary rounded-full h-2 mb-4">
        <div
          className={`h-2 rounded-full transition-all ${
            score >= 80 ? "bg-success" : score >= 60 ? "bg-info" : "bg-warning"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>

      {connections.length > 0 && (
        <p className="text-sm text-text-muted">
          {connections.length} {connections.length === 1 ? "contact" : "contacts"} at this company
          {hasRecruiter && ", including a recruiter"}
        </p>
      )}
    </div>
  );
}
