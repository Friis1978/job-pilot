"use client";

import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";

const RESEARCH_WARNING_KEY = "research-warning";

type Props = {
  jobId: string;
  hasResearch?: boolean;
};

export function ResearchButton({ jobId, hasResearch = false }: Props) {
  const [loading, setLoading] = useState(false);

  // After page reload, surface any warning that was stored before the reload
  useEffect(() => {
    const pending = sessionStorage.getItem(RESEARCH_WARNING_KEY);
    if (pending) {
      sessionStorage.removeItem(RESEARCH_WARNING_KEY);
      toast(pending, "warning");
    }
  }, []);

  async function handleResearch() {
    if (loading) return;
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min max

    async function doResearch(): Promise<Response> {
      return fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
        signal: controller.signal,
      });
    }

    try {
      let res = await doResearch();

      if (res.status === 401) {
        // Session expired — silently refresh and retry once before giving up.
        await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
        res = await doResearch();
        if (res.status === 401) {
          toast("Your session has expired. Please reload the page and try again.", "error");
          return;
        }
      }

      let json: { error?: string; warning?: string; success?: boolean };
      try {
        json = await res.json();
      } catch {
        toast("Research timed out. The company website may be slow — please try again.", "error");
        return;
      }

      if (!res.ok || json.error) {
        toast(json.error ?? "Research failed. Please try again.", "error");
        return;
      }

      if (json.warning) {
        sessionStorage.setItem(RESEARCH_WARNING_KEY, json.warning);
      }
      window.location.reload();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        toast("Research timed out after 2 minutes. Please try again.", "error");
      } else {
        toast("Could not reach the server. Check your connection and try again.", "error");
      }
    } finally {
      clearTimeout(timeoutId);
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
        {loading ? "Re-researching..." : "Re-run"}
      </button>
    );
  }

  return (
    <button
      onClick={handleResearch}
      disabled={loading}
      className={`flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium transition-colors ${loading ? "opacity-60 cursor-not-allowed" : "hover:bg-accent-dark"}`}
    >
      {loading ? (
        <SpinnerIcon className="w-4 h-4 animate-spin" />
      ) : (
        <SearchIcon className="w-4 h-4" />
      )}
      {loading ? "Researching..." : "Research Company"}
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

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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
