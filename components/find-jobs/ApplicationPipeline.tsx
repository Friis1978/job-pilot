"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import type { JobStatus } from "./StatusBadge";

const STAGES: Array<{ key: Exclude<JobStatus, "rejected">; label: string; description: string }> = [
  { key: "saved",        label: "Saved",        description: "Added to your list" },
  { key: "applied",      label: "Applied",       description: "Application submitted" },
  { key: "interviewing", label: "Interviewing",  description: "In the interview process" },
  { key: "offer",        label: "Offer",         description: "Received an offer" },
];

const STAGE_INDEX: Record<string, number> = {
  saved: 0, applied: 1, interviewing: 2, offer: 3,
};

type Props = { jobId: string; status: JobStatus };

export function ApplicationPipeline({ jobId, status: initialStatus }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<JobStatus>(initialStatus);
  const [saving, setSaving] = useState(false);

  const isRejected = status === "rejected";
  const currentIndex = isRejected ? -1 : (STAGE_INDEX[status] ?? 0);

  async function updateStatus(next: JobStatus) {
    if (next === status || saving) return;
    setSaving(true);
    const prev = status;
    setStatus(next); // optimistic
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setStatus(prev);
      toast("Failed to update status. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <PipelineIcon className="w-5 h-5 text-text-muted shrink-0" />
          <h2 className="text-base font-semibold text-text-primary">Application Pipeline</h2>
        </div>
        {!isRejected && (
          <button
            onClick={() => updateStatus("rejected")}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:border-error hover:text-error transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XIcon className="w-3 h-3" />
            Mark Rejected
          </button>
        )}
      </div>

      {isRejected ? (
        /* Rejected state */
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-secondary border border-border rounded-xl">
            <XCircleIcon className="w-5 h-5 text-error shrink-0" />
            <span className="text-sm font-semibold text-error">Application Rejected</span>
          </div>
          <p className="text-sm text-text-muted text-center">
            This application was marked as rejected.
          </p>
          <button
            onClick={() => updateStatus("saved")}
            disabled={saving}
            className="text-sm text-accent hover:text-accent-dark transition-colors disabled:opacity-50"
          >
            Restore to Saved
          </button>
        </div>
      ) : (
        /* Pipeline stages */
        <div className="relative">
          {/* Connector line */}
          <div className="absolute top-5 left-5 right-5 h-px bg-border" aria-hidden />
          {/* Active portion of line */}
          {currentIndex > 0 && (
            <div
              className="absolute top-5 left-5 h-px bg-accent transition-all duration-500"
              style={{ width: `calc(${(currentIndex / (STAGES.length - 1)) * 100}% - 20px + 8px)` }}
              aria-hidden
            />
          )}

          <div className="relative flex justify-between">
            {STAGES.map((stage, i) => {
              const isCompleted = i < currentIndex;
              const isCurrent = i === currentIndex;
              const isUpcoming = i > currentIndex;

              return (
                <button
                  key={stage.key}
                  onClick={() => updateStatus(stage.key)}
                  disabled={saving || isCurrent}
                  className="flex flex-col items-center gap-2 group disabled:cursor-default"
                  title={isCurrent ? stage.label : `Move to ${stage.label}`}
                >
                  {/* Node */}
                  <div
                    className={`relative w-10 h-10 rounded-full flex items-center justify-center transition-all border-2 ${
                      isCompleted
                        ? "bg-accent border-accent"
                        : isCurrent
                        ? "bg-accent border-accent ring-4 ring-accent/20"
                        : "bg-surface border-border group-hover:border-accent/50 group-hover:bg-accent-muted"
                    }`}
                  >
                    {isCompleted ? (
                      <CheckIcon className="w-4 h-4 text-accent-foreground" />
                    ) : (
                      <span
                        className={`text-xs font-semibold ${
                          isCurrent ? "text-accent-foreground" : "text-text-muted group-hover:text-accent"
                        }`}
                      >
                        {i + 1}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className={`text-xs font-semibold ${
                        isCompleted || isCurrent ? "text-text-primary" : isUpcoming ? "text-text-muted group-hover:text-text-secondary" : "text-text-muted"
                      }`}
                    >
                      {stage.label}
                    </span>
                    <span className="text-xs text-text-muted hidden sm:block text-center max-w-[80px] leading-tight">
                      {stage.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PipelineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="19" cy="12" r="2.5" />
      <path d="M7.5 12h2M14.5 12h2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  );
}
