"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { MATCH_THRESHOLD, formatDateAgo } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { JobRow } from "@/types";
import { StatusBadge } from "@/components/find-jobs/StatusBadge";
import type { JobStatus } from "@/components/find-jobs/StatusBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { NetworkBadge } from "@/components/network/NetworkBadge";
import type { Connection } from "@/types";

export type { JobRow };

type FilterOption = "all" | "high" | "low";
type SortCol = "company" | "title" | "location" | "match_score" | "status" | "found_at";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | JobStatus;

const PAGE_SIZE = 20;

const FILTER_LABELS: Record<FilterOption, string> = {
  all: "All Matches",
  high: "High Match",
  low: "Low Match",
};

const FILTER_CYCLE: FilterOption[] = ["all", "high", "low"];

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string; dot: string }> = [
  { key: "all",          label: "All",          dot: "" },
  { key: "saved",        label: "Saved",        dot: "bg-border" },
  { key: "applied",      label: "Applied",      dot: "bg-info" },
  { key: "interviewing", label: "Interviewing", dot: "bg-accent" },
  { key: "offer",        label: "Offer",        dot: "bg-success" },
  { key: "rejected",     label: "Rejected",     dot: "bg-error" },
  { key: "no_fit",       label: "No fit",       dot: "bg-warning" },
];

function getBarColor(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-info";
  return "bg-warning";
}

export function JobsTable({ jobs, connectionMap = {} }: { jobs: JobRow[]; connectionMap?: Record<string, Connection[]> }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterOption>("all");
  const [sortCol, setSortCol] = useState<SortCol>("match_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("saved");
  const [showNoFit, setShowNoFit] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDropdownStyle, setFilterDropdownStyle] = useState<React.CSSProperties>({});
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (
        filterBtnRef.current && !filterBtnRef.current.contains(t) &&
        filterDropdownRef.current && !filterDropdownRef.current.contains(t)
      ) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function openFilterDropdown(e: React.MouseEvent) {
    e.stopPropagation();
    if (!filterOpen && filterBtnRef.current) {
      const rect = filterBtnRef.current.getBoundingClientRect();
      setFilterDropdownStyle({ position: "fixed", top: rect.bottom + 4, left: rect.left, minWidth: 260 });
    }
    setFilterOpen((v) => !v);
  }

  const filterActiveCount = (filter !== "all" ? 1 : 0) + selectedSkills.size;

  function handleSort(col: SortCol) {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return col;
      }
      // Default direction per column
      setSortDir(col === "company" || col === "title" || col === "location" || col === "status" ? "asc" : "desc");
      return col;
    });
    setPage(1);
  }

  function handleSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function handleStatusFilter(s: StatusFilter) {
    setStatusFilter(s);
    setPage(1);
  }

  function handleDeleteJob(e: React.MouseEvent, jobId: string) {
    e.stopPropagation();
    setConfirmDeleteId(jobId);
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    const jobId = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast("Failed to delete job. Please try again.", "error");
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

  // Hide no_fit by default unless explicitly shown or filtered to
  if (!showNoFit && statusFilter !== "no_fit") {
    filtered = filtered.filter((job) => (job.status ?? "saved") !== "no_fit");
  }

  // Status filter
  if (statusFilter !== "all") {
    filtered = filtered.filter((job) => (job.status ?? "saved") === statusFilter);
  }

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
        j.title.toLowerCase().includes(q) ||
        (j.matched_skills ?? []).some((s) => s.toLowerCase().includes(q)),
    );
  }

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    switch (sortCol) {
      case "company":   return mul * a.company.localeCompare(b.company);
      case "title":     return mul * a.title.localeCompare(b.title);
      case "location":  return mul * (a.location ?? "").localeCompare(b.location ?? "");
      case "match_score": return mul * (a.match_score - b.match_score);
      case "status":    return mul * ((a.status ?? "saved").localeCompare(b.status ?? "saved"));
      case "found_at":  return mul * (new Date(a.found_at).getTime() - new Date(b.found_at).getTime());
      default:          return 0;
    }
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
          placeholder="Filter by company, role or skill..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none bg-transparent"
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            ref={filterBtnRef}
            onClick={openFilterDropdown}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
              filterActiveCount > 0
                ? "border-accent text-accent bg-accent-muted"
                : "border-border text-text-primary hover:bg-surface-secondary"
            }`}
          >
            <FilterIcon className="w-3.5 h-3.5" />
            Filter
            {filterActiveCount > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-accent text-accent-foreground text-[10px] font-bold">
                {filterActiveCount}
              </span>
            )}
            <ChevronDownIcon className="w-3.5 h-3.5 text-text-muted" />
          </button>
          {jobs.some((j) => (j.status ?? "saved") === "no_fit") && (
            <button
              onClick={() => setShowNoFit((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                showNoFit
                  ? "border-warning text-warning bg-warning/10"
                  : "border-border text-text-secondary hover:bg-surface-secondary"
              }`}
            >
              <EyeIcon className="w-3.5 h-3.5" showing={showNoFit} />
              {showNoFit ? "Hide No fit" : "Show No fit"}
            </button>
          )}
        </div>
      </div>

      {typeof document !== "undefined" && filterOpen && createPortal(
        <div
          ref={filterDropdownRef}
          style={filterDropdownStyle}
          className="bg-surface border border-border rounded-xl shadow-lg p-3 z-[9999] flex flex-col gap-3"
        >
          {/* Match */}
          <div className="flex flex-col gap-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted px-1">Match</p>
            <div className="flex gap-1.5">
              {FILTER_CYCLE.map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1); }}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    filter === f
                      ? "bg-accent text-accent-foreground border-accent"
                      : "border-border text-text-secondary hover:border-accent hover:text-accent"
                  }`}
                >
                  {FILTER_LABELS[f]}
                </button>
              ))}
            </div>
          </div>
          {/* Skills */}
          {allSkills.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between px-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Skills</p>
                {selectedSkills.size > 0 && (
                  <button
                    onClick={() => { setSelectedSkills(new Set()); setPage(1); }}
                    className="text-[10px] text-text-muted hover:text-error transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
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
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Status Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(({ key, label, dot }) => {
          const active = statusFilter === key;
          const count = key === "all"
            ? jobs.length
            : jobs.filter((j) => (j.status ?? "saved") === key).length;
          if (key !== "all" && count === 0) return null;
          return (
            <button
              key={key}
              onClick={() => handleStatusFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? "bg-accent text-accent-foreground border-accent"
                  : "bg-surface border-border text-text-secondary hover:border-accent hover:text-accent"
              }`}
            >
              {dot && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? "bg-accent-foreground" : dot}`} />
              )}
              {label}
              <span className={`${active ? "text-accent-foreground/70" : "text-text-muted"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

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
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-border">
                  {(
                    [
                      { col: "company",     label: "Company",     width: "",        hide: "",                     pad: "px-3 md:px-6" },
                      { col: "title",       label: "Role",        width: "",        hide: "",                     pad: "px-3 md:px-6" },
                      { col: "location",    label: "Location",    width: "w-[14%]", hide: "hidden md:table-cell", pad: "px-3 md:px-6" },
                      { col: "match_score", label: "Match",       width: "w-[14%]", hide: "",                     pad: "pl-2 pr-3 md:px-6" },
                      { col: "status",      label: "Status",      width: "w-[12%]", hide: "hidden md:table-cell", pad: "px-3 md:px-6" },
                      { col: "found_at",    label: "Date Found",  width: "w-[10%]", hide: "hidden md:table-cell", pad: "px-3 md:px-6" },
                    ] as Array<{ col: SortCol; label: string; width: string; hide: string; pad: string }>
                  ).map(({ col, label, width, hide, pad }) => (
                    <th
                      key={col}
                      onClick={() => handleSort(col)}
                      className={`${pad} py-4 text-left text-xs font-medium uppercase tracking-wide cursor-pointer select-none whitespace-nowrap transition-colors ${width} ${hide} ${
                        sortCol === col ? "text-text-primary" : "text-text-secondary hover:text-text-primary"
                      }`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {label}
                        <SortIcon active={sortCol === col} dir={sortDir} />
                      </span>
                    </th>
                  ))}
                  <th className="py-4 w-10 md:w-14" />
                </tr>
              </thead>
              <tbody>
                {paginated.map((job, index) => (
                  <tr
                    key={job.id}
                    onClick={() => router.push(`/find-jobs/${job.id}`)}
                    className={`group hover:bg-surface-secondary transition-colors cursor-pointer${index < paginated.length - 1 ? " border-b border-border" : ""}`}
                  >
                    <td className="px-3 md:px-6 py-4 max-w-0">
                      {(() => {
                        const jobConnections = connectionMap[job.company.toLowerCase().trim()] ?? [];
                        return (
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="relative hidden md:flex shrink-0 w-9 h-9 bg-surface-secondary border border-border rounded-lg items-center justify-center">
                              <BuildingIcon className="w-5 h-5 text-text-muted" />
                              {jobConnections.length > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-linkedin text-linkedin-foreground text-[9px] font-bold leading-none">
                                  {jobConnections.length}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <Tooltip content={job.company}>
                                  <span className="text-sm font-semibold text-text-primary truncate block">
                                    {job.company}
                                  </span>
                                </Tooltip>
                                <NetworkBadge connections={jobConnections} />
                              </div>
                              <SourceBadge source={job.source} />
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 md:px-6 py-4 max-w-0">
                      <Tooltip content={job.title}>
                        <span className="text-sm text-text-primary truncate block">
                          {job.title}
                        </span>
                      </Tooltip>
                    </td>
                    <td className="px-6 py-4 max-w-0 hidden md:table-cell">
                      {job.location ? (
                        <Tooltip content={job.location}>
                          <span className="text-sm text-text-muted truncate block">
                            {job.location}
                          </span>
                        </Tooltip>
                      ) : (
                        <span className="text-sm text-text-muted">—</span>
                      )}
                    </td>
                    <td className="pl-2 pr-3 md:px-6 py-4 whitespace-nowrap overflow-hidden">
                      <div className="flex items-center gap-3">
                        <div className="hidden md:block w-16 h-1 bg-border rounded-full overflow-hidden shrink-0">
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
                    <td className="px-6 py-4 hidden md:table-cell">
                      <StatusBadge jobId={job.id} status={(job.status as JobStatus) ?? "saved"} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                      <span className="text-sm text-text-muted">
                        {formatDateAgo(job.found_at)}
                      </span>
                    </td>
                    <td className="py-4 pr-3 md:pr-4 text-right">
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

      {confirmDeleteId !== null && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="bg-surface border border-border rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-text-primary">Delete job?</h2>
              <p className="text-sm text-text-muted">This will permanently remove the job and all associated data. This cannot be undone.</p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-lg border border-border text-sm text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-error text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
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

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`inline-flex flex-col gap-[2px] ${active ? "text-text-primary" : "text-text-muted"}`}>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="currentColor" className={active && dir === "asc" ? "opacity-100" : "opacity-30"}>
        <path d="M3.5 0L7 4H0L3.5 0Z" />
      </svg>
      <svg width="7" height="4" viewBox="0 0 7 4" fill="currentColor" className={active && dir === "desc" ? "opacity-100" : "opacity-30"}>
        <path d="M3.5 4L0 0H7L3.5 4Z" />
      </svg>
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

function FilterIcon({ className }: { className?: string }) {
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
      <path d="M3 5h14M6 10h8M9 15h2" />
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

function EyeIcon({ className, showing }: { className?: string; showing: boolean }) {
  return showing ? (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
      <circle cx="10" cy="10" r="2.5" />
      <path d="M3 3l14 14" />
    </svg>
  ) : (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6z" />
      <circle cx="10" cy="10" r="2.5" />
    </svg>
  );
}
