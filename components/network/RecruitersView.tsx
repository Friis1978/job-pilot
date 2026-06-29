import type { Connection } from "@/types";
import { isRecruiter } from "@/lib/network-utils";
import { ConnectionsTable } from "@/components/network/ConnectionsTable";

type Props = {
  connections: Connection[];
};

export function RecruitersView({ connections }: Props) {
  const recruiters = connections.filter(isRecruiter);

  if (recruiters.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm text-center">
        <p className="text-sm text-text-muted">No recruiters found in your connections.</p>
        <p className="text-xs text-text-muted mt-1">Recruiters are detected by job title keywords like "Recruiter", "Talent Acquisition", "Headhunter".</p>
      </div>
    );
  }

  return <ConnectionsTable connections={recruiters} />;
}
