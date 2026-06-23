"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

type Props = {
  jobId: string;
  hasSummary: boolean;
};

export function RegenerateDescriptionButton({ jobId, hasSummary }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRegenerate() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/regenerate-description`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast(json.error ?? "Failed to regenerate description.", "error");
        return;
      }
      window.location.reload();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (hasSummary) {
    return (
      <button
        onClick={handleRegenerate}
        disabled={loading}
        title={loading ? "Re-generating..." : "Re-generate summary"}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Re-generating..." : "Re-run"}
      </button>
    );
  }

  return (
    <button
      onClick={handleRegenerate}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium transition-colors ${loading ? "opacity-60 cursor-not-allowed" : "hover:bg-accent-dark"}`}
    >
      {loading ? (
        <SpinnerIcon className="w-4 h-4 animate-spin" />
      ) : (
        <DocIcon className="w-4 h-4" />
      )}
      {loading ? "Generating..." : "Generate summary"}
    </button>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4a8 8 0 0 1 12 0M4 16a8 8 0 0 0 12 0" />
      <path d="M2 6l2-2 2 2M14 14l2 2 2-2" />
    </svg>
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

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}
