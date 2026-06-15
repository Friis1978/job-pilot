"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

type Props = {
  jobId: string;
};

export function RescoreButton({ jobId }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleRescore() {
    if (loading) return;
    setLoading(true);
    try {
      let res = await fetch(`/api/jobs/${jobId}/rescore`, { method: "POST" });
      if (res.status === 401) {
        // Session expired — silently refresh and retry once before giving up.
        await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        res = await fetch(`/api/jobs/${jobId}/rescore`, { method: "POST" });
        if (res.status === 401) {
          toast("Your session has expired. Please reload the page.", "error");
          return;
        }
      }
      const json = await res.json();
      if (!res.ok || json.error) {
        toast(json.error ?? "Re-scoring failed. Please try again.", "error");
        return;
      }
      window.location.reload();
    } catch {
      toast("Could not reach the server. Check your connection.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRescore}
      disabled={loading}
      title={loading ? "Re-scoring..." : "Re-run skill matching against your current profile"}
      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Re-scoring..." : "Re-score"}
    </button>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 4a8 8 0 0 1 12 0M4 16a8 8 0 0 0 12 0" />
      <path d="M2 6l2-2 2 2M14 14l2 2 2-2" />
    </svg>
  );
}
