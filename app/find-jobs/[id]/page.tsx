import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createInsforgeServer } from "@/lib/insforge-server";
import { formatDateAgo } from "@/lib/utils";
import { Navbar } from "@/components/layout/Navbar";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  about_role: string | null;
  match_score: number;
  match_reason: string | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  company_research: Record<string, unknown> | null;
  external_apply_url: string | null;
  found_at: string;
};

function formatJobType(jobType: string | null): string {
  if (!jobType) return "—";
  const map: Record<string, string> = {
    fulltime: "Full Time",
    full_time: "Full Time",
    permanent: "Full Time",
    parttime: "Part Time",
    part_time: "Part Time",
    contract: "Contract",
    temporary: "Temporary",
  };
  return map[jobType.toLowerCase()] ?? jobType;
}

function getMatchColor(score: number): string {
  if (score >= 90) return "text-success";
  if (score >= 80) return "text-info-medium";
  return "text-warning";
}

export default async function JobDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();
  if (!user) redirect("/login");

  const { data, error } = await insforge.database
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) notFound();
  const job = data as Job;

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background py-8">
        <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 flex flex-col gap-5 pb-12">

          {/* Back to Jobs */}
          <Link
            href="/find-jobs"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Jobs
          </Link>

          {/* Job Header Card */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex items-center gap-4">
            <div className="shrink-0 w-12 h-12 bg-surface-secondary border border-border rounded-xl flex items-center justify-center">
              <BuildingIcon className="w-6 h-6 text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-text-primary leading-tight">
                {job.title}
              </h1>
              <p className="mt-0.5 text-sm text-text-secondary">
                {job.company}
                <span className="mx-2">•</span>
                <span className={`font-semibold ${getMatchColor(job.match_score)}`}>
                  {job.match_score}% Match Score
                </span>
              </p>
            </div>
            {job.external_apply_url && (
              <a
                href={job.external_apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-surface-secondary transition-colors"
              >
                <ExternalLinkIcon className="w-4 h-4" />
                View Job Post
              </a>
            )}
          </div>

          {/* Info Cards Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <InfoCard
              icon={<DollarIcon className="w-5 h-5 text-success shrink-0" />}
              value={job.salary ?? "—"}
              label="Salary Est."
            />
            <InfoCard
              icon={<PinIcon className="w-5 h-5 text-info-medium shrink-0" />}
              value={job.location ?? "—"}
              label="Location"
            />
            <InfoCard
              icon={<BriefcaseIcon className="w-5 h-5 text-info-medium shrink-0" />}
              value={formatJobType(job.job_type)}
              label="Job Type"
            />
            <InfoCard
              icon={<CalendarIcon className="w-5 h-5 text-info-medium shrink-0" />}
              value={formatDateAgo(job.found_at)}
              label="Date Found"
            />
          </div>

          {/* AI Match Reasoning */}
          {job.match_reason && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <SparkleIcon className="w-4 h-4 text-success shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  AI Match Reasoning
                </span>
              </div>
              <p className="text-sm text-text-primary leading-relaxed">
                {job.match_reason}
              </p>
            </div>
          )}

          {/* Required Skills vs Your Profile */}
          {((job.matched_skills?.length ?? 0) > 0 ||
            (job.missing_skills?.length ?? 0) > 0) && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-4">
                Required Skills vs Your Profile
              </p>

              {(job.matched_skills?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-text-secondary mb-2">You have</p>
                  <div className="flex flex-wrap gap-2">
                    {job.matched_skills!.map((skill) => (
                      <span
                        key={skill}
                        className="flex items-center gap-1 px-3 py-1 bg-success-lightest text-success-foreground rounded-full text-sm font-medium"
                      >
                        <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(job.missing_skills?.length ?? 0) > 0 && (
                <div>
                  <p className="text-sm text-text-secondary mb-2">Gap skills</p>
                  <div className="flex flex-wrap gap-2">
                    {job.missing_skills!.map((skill) => (
                      <span
                        key={skill}
                        className="flex items-center gap-1 px-3 py-1 bg-accent-muted text-accent rounded-full text-sm font-medium"
                      >
                        <XSmallIcon className="w-3.5 h-3.5 shrink-0" />
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Job Description */}
          {job.about_role && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <DocIcon className="w-5 h-5 text-text-muted shrink-0" />
                <h2 className="text-base font-semibold text-text-primary">
                  Job Description
                </h2>
              </div>
              <p className="text-sm text-text-primary leading-relaxed">
                {job.about_role}
              </p>
              {job.external_apply_url && (
                <a
                  href={job.external_apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center gap-1.5 text-sm text-accent hover:text-accent-dark transition-colors w-fit"
                >
                  View full description
                  <ExternalLinkIcon className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}

          {/* Company Research */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <BuildingIcon className="w-5 h-5 text-text-muted shrink-0" />
              <h2 className="flex-1 text-base font-semibold text-text-primary">
                Company Research
              </h2>
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium opacity-80 cursor-not-allowed"
              >
                <SearchIcon className="w-4 h-4" />
                Research Company
              </button>
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="w-10 h-10 flex items-center justify-center">
                <BuildingIcon className="w-8 h-8 text-border" />
              </div>
              <p className="text-sm font-medium text-text-primary">
                No research yet
              </p>
              <p className="text-sm text-text-muted text-center max-w-xs">
                Click &ldquo;Research Company&rdquo; to let the AI browse{" "}
                {job.company}&apos;s public pages and build a dossier.
              </p>
            </div>
          </div>

          {/* Apply Now */}
          {job.external_apply_url && (
            <a
              href={job.external_apply_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-accent text-accent-foreground rounded-xl text-base font-semibold text-center hover:bg-accent-dark transition-colors"
            >
              Apply Now at {job.company}
            </a>
          )}
        </div>
      </main>
    </>
  );
}

function InfoCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text-primary truncate">
            {value}
          </p>
          <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12L6 8l4-4" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M3 7l9-4 9 4M4 7v14M20 7v14M9 21V12h6v9" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 3h6v6M17 3l-8 8M8 5H4a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1v-4" />
    </svg>
  );
}

function DollarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  );
}

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-8-6.895-8-12a8 8 0 1116 0c0 5.105-8 12-8 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M12 12v4M10 14h4" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  );
}

function XSmallIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 4l8 8M12 4l-8 8" />
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

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M13.5 13.5L17 17" />
    </svg>
  );
}
