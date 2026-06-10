"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

type Props = {
  jobId: string;
  hasResearch?: boolean;
};

export function ResearchButton({ jobId, hasResearch = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleResearch() {
    if (loading) return;
    setLoading(true);
    setDone(false);

    try {
      const res = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        toast(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      toast("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (hasResearch) {
    return (
      <button
        onClick={handleResearch}
        disabled={loading}
        title={loading ? "Re-researching..." : "Re-run research"}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshIcon className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Re-researching..." : done ? "Done" : "Re-run"}
      </button>
    );
  }

  return (
    <button
      onClick={handleResearch}
      disabled={loading || done}
      className={`flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium transition-colors ${loading || done ? "opacity-60 cursor-not-allowed" : "hover:bg-accent-dark"}`}
    >
      <SearchIcon className="w-4 h-4" />
      {loading ? "Researching..." : done ? "Research Complete" : "Research Company"}
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
    >
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M13.5 13.5L17 17" />
    </svg>
  );
}
