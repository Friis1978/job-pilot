"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SearchCard() {
  const router = useRouter();
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    jobsFound: number;
    jobsSaved: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!jobTitle.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/agent/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          location: location.trim(),
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }

      setResult(json.data);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-end gap-4">
        {/* Job Title */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Job Title
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <SearchIcon className="w-4 h-4 text-text-muted" />
            </div>
            <input
              type="text"
              placeholder="Frontend Engineer"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
        </div>

        {/* Location */}
        <div className="flex-1 flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Location
          </label>
          <input
            type="text"
            placeholder="Remote, New York..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
          />
        </div>

        {/* Find Jobs Button */}
        <button
          onClick={handleSearch}
          disabled={loading || !jobTitle.trim()}
          className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <SearchIcon className="w-4 h-4" />
          {loading ? "Searching..." : "Find Jobs"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-error">{error}</p>}

      {result && (
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-success-lightest px-4 py-3">
          <SparkleIcon className="w-5 h-5 text-success shrink-0" />
          <span className="text-sm font-medium text-success-foreground">
            Found {result.jobsFound} jobs and saved {result.jobsSaved} strong
            matches.
          </span>
        </div>
      )}
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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.25c-.28 3.48-1.35 6.3-3.31 8.19C6.74 12.36 4.01 13.72 0 14c4.01.28 6.74 1.64 8.69 3.56C10.65 19.45 11.72 22.27 12 25.75c.28-3.48 1.35-6.3 3.31-8.19C17.26 15.64 19.99 14.28 24 14c-4.01-.28-6.74-1.64-8.69-3.56C13.35 8.55 12.28 5.73 12 2.25z" />
    </svg>
  );
}
