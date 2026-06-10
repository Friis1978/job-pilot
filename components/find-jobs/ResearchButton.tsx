"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  jobId: string;
};

export function ResearchButton({ jobId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleResearch() {
    if (loading || done) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      setDone(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={handleResearch}
        disabled={loading || done}
        className={`flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium transition-colors ${loading || done ? "opacity-60 cursor-not-allowed" : "hover:bg-accent-dark"}`}
      >
        <SearchIcon className="w-4 h-4" />
        {loading ? "Researching..." : done ? "Research Complete" : "Research Company"}
      </button>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
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
