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
        toast((body as { error?: string }).error ?? "Failed to generate resume. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast("Failed to generate resume. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium transition-colors hover:bg-accent-dark disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <DocumentIcon className="w-4 h-4 shrink-0" />
        {loading ? "Generating..." : "Download Tailored Resume"}
      </button>
      {!hasResearch && (
        <p className="text-xs text-text-muted">
          Tip: run Company Research first for a more targeted resume.
        </p>
      )}
    </div>
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
