"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

type Props = {
  jobId: string;
  companyName: string;
  hasResearch: boolean;
};

export function TailoredResumeButton({ jobId, companyName, hasResearch }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailored-resume`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast((body as { error?: string }).error ?? "Failed to generate resume. Please try again.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast("Failed to generate resume. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1 shrink-0">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <DocumentIcon className="w-3.5 h-3.5" />
        )}
        {loading ? "Generating..." : "Download Tailored Resume"}
      </button>
      {!hasResearch && (
        <p className="text-xs text-text-muted text-right">
          Run Company Research first for best results.
        </p>
      )}
    </div>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}
