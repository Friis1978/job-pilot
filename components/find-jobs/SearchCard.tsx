"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

type RecentSearch = { jobTitle: string; location: string; searchedAt: string };

type Props = { recentSearches?: RecentSearch[]; defaultLocation?: string };

export function SearchCard({ recentSearches = [], defaultLocation = "" }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "url">("search");

  // Search tab state
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState(defaultLocation);
  const [minScore, setMinScore] = useState(70);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    jobsFound: number;
    jobsSaved: number;
  } | null>(null);

  // URL tab state
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  async function handleSearch() {
    if (!jobTitle.trim() || loading) return;

    setLoading(true);
    setResult(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch("/api/agent/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          location: location.trim(),
          minScore,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const json = await res.json();

      if (!res.ok || json.error) {
        toast(json.error ?? "Something went wrong. Please try again.", "error");
        return;
      }

      setResult(json.data);
      router.refresh();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        toast("Search timed out after 30 seconds. Please try again.", "error");
      } else {
        toast("Something went wrong. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleImport() {
    if (!importUrl.trim() || importing) return;
    setImporting(true);
    setImportSuccess(false);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const res = await fetch("/api/agent/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: importUrl.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const json = await res.json();

      if (!res.ok || json.error) {
        toast(json.error ?? "Import failed. Please try again.", "error");
        return;
      }

      setImportSuccess(true);
      setImportUrl("");
      router.refresh();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        toast("Import timed out. Please try again.", "error");
      } else {
        toast("Something went wrong. Please try again.", "error");
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      {/* Tab switcher */}
      <div className="flex gap-0 border-b border-border mb-5">
        <button
          onClick={() => { setTab("search"); setResult(null); }}
          className={`px-4 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "search"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Find Jobs
        </button>
        <button
          onClick={() => { setTab("url"); setImportSuccess(false); }}
          className={`px-4 pb-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === "url"
              ? "border-accent text-accent"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          Add from URL
        </button>
      </div>

      {tab === "url" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Job Posting URL
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <LinkIcon className="w-4 h-4 text-text-muted" />
                </div>
                <input
                  type="url"
                  placeholder="https://jobs.company.com/..."
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImport()}
                  className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                />
              </div>
            </div>
            <button
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {importing ? (
                <SpinnerIcon className="w-4 h-4 animate-spin" />
              ) : (
                <LinkIcon className="w-4 h-4" />
              )}
              {importing ? "Importing..." : "Import Job"}
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Works with most job boards and company career pages. LinkedIn requires login and cannot be imported automatically.
          </p>
          {importSuccess && (
            <div className="flex items-center gap-3 rounded-xl bg-success-lightest px-4 py-3">
              <SparkleIcon className="w-5 h-5 text-success shrink-0" />
              <span className="text-sm font-medium text-success-foreground">
                Job imported and scored. Check your job list below.
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
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

            {/* Min Match Score */}
            <div className="flex flex-col gap-1.5 shrink-0">
              <label className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Min Match
              </label>
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="px-3 py-2.5 border border-border rounded-lg text-sm text-text-primary bg-surface focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
              >
                {[50, 60, 70].map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </select>
            </div>

            {/* Find Jobs Button */}
            <button
              onClick={handleSearch}
              disabled={loading || !jobTitle.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? (
                <SpinnerIcon className="w-4 h-4 animate-spin" />
              ) : (
                <SearchIcon className="w-4 h-4" />
              )}
              {loading ? "Searching..." : "Find Jobs"}
            </button>
          </div>

          {result && (
            <div className="flex items-center gap-3 rounded-xl bg-success-lightest px-4 py-3">
              <SparkleIcon className="w-5 h-5 text-success shrink-0" />
              <span className="text-sm font-medium text-success-foreground">
                Found {result.jobsFound} jobs and saved {result.jobsSaved} strong matches.
              </span>
            </div>
          )}

          {recentSearches.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                Recent Searches
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setJobTitle(s.jobTitle);
                      setLocation(s.location);
                    }}
                    className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary hover:border-accent hover:text-accent transition-colors"
                  >
                    <SearchIcon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <span className="font-medium">{s.jobTitle}</span>
                    {s.location && (
                      <>
                        <span className="text-text-muted">·</span>
                        <span className="text-text-muted">{s.location}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinkIcon({ className }: { className?: string }) {
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
      <path d="M8.5 11.5a4.5 4.5 0 0 0 6.364 0l2-2a4.5 4.5 0 0 0-6.364-6.364l-1 1" />
      <path d="M11.5 8.5a4.5 4.5 0 0 0-6.364 0l-2 2a4.5 4.5 0 0 0 6.364 6.364l1-1" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
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

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.25c-.28 3.48-1.35 6.3-3.31 8.19C6.74 12.36 4.01 13.72 0 14c4.01.28 6.74 1.64 8.69 3.56C10.65 19.45 11.72 22.27 12 25.75c.28-3.48 1.35-6.3 3.31-8.19C17.26 15.64 19.99 14.28 24 14c-4.01-.28-6.74-1.64-8.69-3.56C13.35 8.55 12.28 5.73 12 2.25z" />
    </svg>
  );
}
