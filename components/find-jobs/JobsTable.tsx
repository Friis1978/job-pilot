"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MATCH_THRESHOLD, formatDateAgo } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { JobRow } from "@/types";
import { StatusBadge } from "@/components/find-jobs/StatusBadge";
import type { JobStatus } from "@/components/find-jobs/StatusBadge";

export type { JobRow };

type FilterOption = "all" | "high" | "low";
type SortOption = "newest" | "oldest" | "match_score";

const PAGE_SIZE = 20;

const FILTER_LABELS: Record<FilterOption, string> = {
  all: "All Matches",
  high: "High Match",
  low: "Low Match",
};

const SORT_LABELS: Record<SortOption, string> = {
  newest: "Newest",
  match_score: "Match Score",
  oldest: "Oldest",
};

const FILTER_CYCLE: FilterOption[] = ["all", "high", "low"];
const SORT_CYCLE: SortOption[] = ["newest", "match_score", "oldest"];

function getBarColor(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-info";
  return "bg-warning";
}

export function JobsTable({ jobs }: { jobs: JobRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());

  function cycleFilter() {
    setFilter((f) => FILTER_CYCLE[(FILTER_CYCLE.indexOf(f) + 1) % FILTER_CYCLE.length]);
    setPage(1);
  }

  function cycleSort() {
    setSort((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length]);
    setPage(1);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  async function handleClearJobs() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setClearing(true);
    try {
      await fetch("/api/jobs/clear", { method: "DELETE" });
      setConfirmClear(false);
      router.refresh();
    } finally {
      setClearing(false);
    }
  }

  function handleClearBlur() {
    setConfirmClear(false);
  }

  async function handleDeleteJob(e: React.MouseEvent, jobId: string) {
    e.stopPropagation();
    setDeletingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast("Failed to delete job. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function toggleSkill(skill: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev);
      next.has(skill) ? next.delete(skill) : next.add(skill);
      return next;
    });
    setPage(1);
  }

  // Collect all unique skills across all jobs, sorted by frequency
  const allSkills = (() => {
    const freq = new Map<string, number>();
    for (const job of jobs) {
      for (const skill of job.matched_skills ?? []) {
        freq.set(skill, (freq.get(skill) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([skill]) => skill);
  })();

  // Filter
  let filtered = jobs.filter((job) => {
    if (filter === "high") return job.match_score >= MATCH_THRESHOLD;
    if (filter === "low") return job.match_score < MATCH_THRESHOLD;
    return true;
  });

  // Skill filter
  if (selectedSkills.size > 0) {
    filtered = filtered.filter((job) =>
      (job.matched_skills ?? []).some((s) => selectedSkills.has(s)),
    );
  }

  // Search
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (j) =>
        j.company.toLowerCase().includes(q) ||
        j.title.toLowerCase().includes(q),
    );
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "match_score") return b.match_score - a.match_score;
    if (sort === "oldest")
      return new Date(a.found_at).getTime() - new Date(b.found_at).getTime();
    return new Date(b.found_at).getTime() - new Date(a.found_at).getTime();
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter Bar */}
      <div className="bg-surface border border-border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
        <FilterSearchIcon className="w-4 h-4 text-text-muted shrink-0" />
        <input
          type="text"
          placeholder="Filter by company or role..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none bg-transparent"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={cycleFilter}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
              filter !== "all"
                ? "border-accent text-accent bg-accent-muted"
                : "border-border text-text-primary hover:bg-surface-secondary"
            }`}
          >
            {FILTER_LABELS[filter]}
            <ChevronDownIcon className="w-3.5 h-3.5 text-text-muted" />
          </button>
          <button
            onClick={cycleSort}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
              sort !== "newest"
                ? "border-accent text-accent bg-accent-muted"
                : "border-border text-text-primary hover:bg-surface-secondary"
            }`}
          >
            {SORT_LABELS[sort]}
            <ChevronDownIcon className="w-3.5 h-3.5 text-text-muted" />
          </button>
          {jobs.length > 0 && (
            <button
              onClick={handleClearJobs}
              onBlur={handleClearBlur}
              disabled={clearing}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                confirmClear
                  ? "border-error text-error bg-surface-secondary"
                  : "border-border text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              <TrashIcon className="w-3.5 h-3.5" />
              {clearing ? "Clearing..." : confirmClear ? "Confirm clear" : "Clear all"}
            </button>
          )}
        </div>
      </div>

      {/* Skill Filter Chips */}
      {allSkills.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedSkills.size > 0 && (
            <button
              onClick={() => { setSelectedSkills(new Set()); setPage(1); }}
              className="text-xs text-text-muted hover:text-error transition-colors"
            >
              Clear
            </button>
          )}
          {allSkills.map((skill) => {
            const active = selectedSkills.has(skill);
            return (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors border ${
                  active
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-surface border-border text-text-secondary hover:border-accent hover:text-accent"
                }`}
              >
                {skill}
              </button>
            );
          })}
        </div>
      )}

      {/* Jobs Table Card */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        {jobs.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-text-primary">
              No jobs found yet
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Use the search above to find jobs matching your profile.
            </p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-medium text-text-primary">
              No matches for your filter
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Try adjusting the filter or search term.
            </p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary w-[18%]">
                    Company
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary w-[20%]">
                    Role
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary w-[12%]">
                    Location
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary w-[16%]">
                    Match Score
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary w-[10%]">
                    Salary Est.
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary w-[10%]">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium uppercase tracking-wide text-text-secondary w-[8%]">
                    Date Found
                  </th>
                  <th className="px-4 py-4 w-[6%]" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((job, index) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/find-jobs/${job.id}`)}
                    className={`group hover:bg-surface-secondary transition-colors cursor-pointer${index < paginated.length - 1 ? " border-b border-border" : ""}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="shrink-0 w-9 h-9 bg-surface-secondary border border-border rounded-lg flex items-center justify-center">
                          <BuildingIcon className="w-5 h-5 text-text-muted" />
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-text-primary">
                            {job.company}
                          </span>
                          <SourceBadge source={job.source} />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-primary">
                        {job.title}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-muted">
                        {job.location ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-32 h-1 bg-border rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${getBarColor(job.match_score)}`}
                            style={{ width: `${job.match_score}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-text-primary tabular-nums">
                          {job.match_score}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-primary">
                        {job.salary ?? "—"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge jobId={job.id} status={(job.status as JobStatus) ?? "saved"} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-muted">
                        {formatDateAgo(job.found_at)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={(e) => handleDeleteJob(e, job.id)}
                        disabled={deletingId === job.id}
                        className="opacity-0 group-hover:opacity-100 flex items-center justify-center w-7 h-7 rounded-lg text-text-muted hover:text-error hover:bg-surface-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Delete job"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between border-t border-border">
                <p className="text-sm text-text-muted">
                  Showing{" "}
                  <span className="font-medium text-text-primary">
                    {(currentPage - 1) * PAGE_SIZE + 1}
                  </span>{" "}
                  to{" "}
                  <span className="font-medium text-text-primary">
                    {Math.min(currentPage * PAGE_SIZE, sorted.length)}
                  </span>{" "}
                  of{" "}
                  <span className="font-medium text-text-primary">
                    {sorted.length}
                  </span>{" "}
                  results
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 border border-border rounded-lg text-sm transition-colors ${
                          p === currentPage
                            ? "font-semibold text-text-primary bg-surface-secondary"
                            : "text-text-primary hover:bg-surface-secondary"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  jobtech: "Jobtech",
  jooble: "Jooble",
  careerjet: "Careerjet",
  adzuna: "Adzuna",
  glassdoor: "Glassdoor",
  url: "Imported",
};

function SourceBadge({ source }: { source: string }) {
  const label = SOURCE_LABELS[source] ?? source;
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-surface-secondary text-text-muted border border-border w-fit">
      {label}
    </span>
  );
}

function FilterSearchIcon({ className }: { className?: string }) {
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

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 5h14M8 5V3h4v2M6 5l1 12h6l1-12" />
    </svg>
  );
}
