"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

export type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

const STATUS_CONFIG: Record<JobStatus, { label: string; pill: string }> = {
  saved:        { label: "Saved",        pill: "bg-surface-secondary text-text-secondary border border-border" },
  applied:      { label: "Applied",      pill: "bg-info-lightest text-info-foreground border border-info-light" },
  interviewing: { label: "Interviewing", pill: "bg-accent-muted text-accent border border-accent-light" },
  offer:        { label: "Offer",        pill: "bg-success-lightest text-success-foreground border border-success-light" },
  rejected:     { label: "Rejected",     pill: "bg-surface-secondary text-error border border-border" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as JobStatus[];

type Props = { jobId: string; status: JobStatus };

export function StatusBadge({ jobId, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<JobStatus>(status);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSelect(e: React.MouseEvent, next: JobStatus) {
    e.stopPropagation();
    if (next === current || saving) return;
    setOpen(false);
    setSaving(true);
    const prev = current;
    setCurrent(next); // optimistic
    try {
      const res = await fetch(`/api/jobs/${jobId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setCurrent(prev); // rollback
      toast("Failed to update status. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  const config = STATUS_CONFIG[current];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        disabled={saving}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${config.pill} disabled:opacity-60`}
      >
        {config.label}
        <ChevronIcon className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-36 bg-surface border border-border rounded-xl shadow-lg py-1 z-50">
          {ALL_STATUSES.map((s) => (
            <button
              key={s}
              onClick={(e) => handleSelect(e, s)}
              className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover:bg-surface-secondary ${
                s === current ? "text-accent" : "text-text-primary"
              }`}
            >
              {STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
