"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

export type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected" | "no_fit";

const STATUS_CONFIG: Record<JobStatus, { label: string; pill: string }> = {
  saved:        { label: "Saved",        pill: "bg-surface-secondary text-text-secondary border border-border" },
  applied:      { label: "Applied",      pill: "bg-info-lightest text-info-foreground border border-info-light" },
  interviewing: { label: "Interviewing", pill: "bg-accent-muted text-accent border border-accent-light" },
  offer:        { label: "Offer",        pill: "bg-success-lightest text-success-foreground border border-success-light" },
  rejected:     { label: "Rejected",     pill: "bg-surface-secondary text-error border border-border" },
  no_fit:       { label: "No fit",       pill: "bg-warning/10 text-warning border border-warning/30" },
};

const ALL_STATUSES = Object.keys(STATUS_CONFIG) as JobStatus[];

type Props = { jobId: string; status: JobStatus };

export function StatusBadge({ jobId, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<JobStatus>(status);
  const [saving, setSaving] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = ALL_STATUSES.length * 32 + 8; // approx
      if (spaceBelow < dropdownHeight) {
        setDropdownStyle({ position: "fixed", left: rect.left, bottom: window.innerHeight - rect.top + 4, width: 144 });
      } else {
        setDropdownStyle({ position: "fixed", left: rect.left, top: rect.bottom + 4, width: 144 });
      }
    }
    setOpen((o) => !o);
  }

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

  const dropdown = open ? (
    <div
      ref={dropdownRef}
      style={dropdownStyle}
      className="bg-surface border border-border rounded-xl shadow-lg py-1 z-[9999]"
    >
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
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        onClick={handleOpen}
        disabled={saving}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${config.pill} disabled:opacity-60`}
      >
        {config.label}
        <ChevronIcon className="w-3 h-3 opacity-60" />
      </button>

      {typeof document !== "undefined" && dropdown && createPortal(dropdown, document.body)}
    </>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
