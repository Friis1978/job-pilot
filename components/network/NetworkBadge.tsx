import type { Connection } from "@/types";
import { isRecruiter } from "@/lib/network-utils";

type Props = {
  connections: Connection[];
};

export function NetworkBadge({ connections }: Props) {
  if (connections.length === 0) return null;

  const hasRecruiter = connections.some(isRecruiter);

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold shrink-0 ${
        hasRecruiter
          ? "bg-linkedin text-linkedin-foreground"
          : "bg-linkedin-light text-linkedin"
      }`}
      title={`${connections.length} connection${connections.length > 1 ? "s" : ""} at this company${hasRecruiter ? " (includes recruiter)" : ""}`}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden>
        <circle cx="5.5" cy="3.5" r="1.75" fill="currentColor" />
        <circle cx="2" cy="5" r="1.25" fill="currentColor" opacity="0.7" />
        <circle cx="9" cy="5" r="1.25" fill="currentColor" opacity="0.7" />
        <path d="M1 10c0-1.1.45-2 1-2s1 .9 1 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        <path d="M10 10c0-1.1-.45-2-1-2s-1 .9-1 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        <path d="M3.5 10c0-1.1.9-2 2-2s2 .9 2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      </svg>
      {connections.length}
    </span>
  );
}
