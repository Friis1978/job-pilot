import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createInsforgeServer } from "@/lib/insforge-server";
import { formatDateAgo, computeSkillYears } from "@/lib/utils";
import type { Profile } from "@/types";
import { Navbar } from "@/components/layout/Navbar";
import { ResearchButton } from "@/components/find-jobs/ResearchButton";
import { CoverLetterSection } from "@/components/find-jobs/CoverLetterSection";
import { TailoredResumeButton } from "@/components/find-jobs/TailoredResumeButton";
import { StatusBadge } from "@/components/find-jobs/StatusBadge";
import { ApplicationPipeline } from "@/components/find-jobs/ApplicationPipeline";
import { RescoreButton } from "@/components/find-jobs/RescoreButton";
import type { JobStatus } from "@/components/find-jobs/StatusBadge";

type ContactInfo = {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  company?: string | null;
};

type CompanyDossier = {
  companyOverview: string;
  companyAddress: string | null;
  contactInfo: ContactInfo | null;
  recruiterContact: ContactInfo | null;
  techStack: string[];
  culture: string[];
  whyThisRole: string;
  yourEdge: string[];
  gapsToAddress: string[];
  smartQuestions: string[];
  interviewPrep: string[];
  sources: string[];
};

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
  description_summary: string | null;
  cover_letter: string | null;
  status: string;
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

  if (!user) redirect("/");
  const userMeta = user.metadata as { full_name?: string; name?: string; avatar_url?: string } | null;

  const { data, error } = await insforge.database
    .from("jobs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) notFound();
  const job = data as Job;

  const { data: profileData } = await insforge.database
    .from("profiles")
    .select("work_experience, avatar_url, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const skillYears = computeSkillYears(
    (profileData as Pick<Profile, "work_experience"> | null)?.work_experience,
  );

  return (
    <>
      <Navbar user={{ name: userMeta?.full_name ?? userMeta?.name, email: user.email, avatarUrl: (profileData as { avatar_url?: string | null } | null)?.avatar_url ?? userMeta?.avatar_url }} isAdmin={(profileData as { is_admin?: boolean } | null)?.is_admin ?? false} />
      <main className="min-h-screen bg-background py-8">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 flex flex-col gap-5 pb-12">

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
            <StatusBadge jobId={job.id} status={(job.status as JobStatus) ?? "saved"} />
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

          {/* Application Pipeline */}
          <ApplicationPipeline jobId={job.id} status={(job.status as JobStatus) ?? "saved"} />

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
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                  Required Skills vs Your Profile
                </p>
                <RescoreButton jobId={job.id} />
              </div>

              {(job.matched_skills?.length ?? 0) > 0 && (
                <div className="mb-4">
                  <p className="text-sm text-text-secondary mb-2">You have</p>
                  <div className="flex flex-wrap gap-2">
                    {job.matched_skills!.map((skill) => {
                      const yrs =
                        skillYears[skill] ??
                        skillYears[
                          Object.keys(skillYears).find(
                            (k) => k.toLowerCase() === skill.toLowerCase(),
                          ) ?? ""
                        ] ??
                        null;
                      return (
                        <span
                          key={skill}
                          className="flex items-center gap-1 px-3 py-1 bg-success-lightest text-success-foreground rounded-full text-sm font-medium"
                        >
                          <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                          {skill}
                          {yrs != null && (
                            <span className="opacity-70 font-normal">· {yrs}yr</span>
                          )}
                        </span>
                      );
                    })}
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
          {(job.description_summary || job.about_role) && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <DocIcon className="w-5 h-5 text-text-muted shrink-0" />
                  <h2 className="text-base font-semibold text-text-primary">
                    Job Description
                  </h2>
                </div>
                {job.external_apply_url && (
                  <a
                    href={job.external_apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-accent hover:text-accent-dark transition-colors shrink-0"
                  >
                    Full posting
                    <ExternalLinkIcon className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              {job.description_summary ? (
                <ul className="flex flex-col gap-2">
                  {job.description_summary
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => {
                      const text = line.replace(/^[•\-\*]\s*/, "");
                      return (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-primary leading-relaxed">
                          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                          {text}
                        </li>
                      );
                    })}
                </ul>
              ) : (
                <p className="text-sm text-text-primary leading-relaxed">{job.about_role}</p>
              )}
            </div>
          )}

          {/* Company Research */}
          <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
              <BuildingIcon className="w-5 h-5 text-text-muted shrink-0" />
              <h2 className="flex-1 text-base font-semibold text-text-primary">
                Company Research
              </h2>
              <ResearchButton jobId={job.id} hasResearch={!!job.company_research} />
            </div>

            <div className="bg-surface-secondary p-5">
              {job.company_research ? (
                <CompanyDossierDisplay
                  dossier={
                    // Safe cast — shape is controlled by research-company agent
                    job.company_research as unknown as CompanyDossier
                  }
                />
              ) : (
                /* Empty state */
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
              )}
            </div>
          </div>

          {/* Tailored Resume */}
          <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <DocIcon className="w-5 h-5 text-text-muted shrink-0" />
              <h2 className="flex-1 text-base font-semibold text-text-primary">Tailored Resume</h2>
            </div>
            <div className="flex items-start gap-4">
              <p className="flex-1 text-sm text-text-secondary leading-5">
                Generate a version of your resume with the summary and bullet points rewritten to match what {job.company} is looking for — based on the job description{job.company_research ? " and company research" : ""}.
              </p>
              <TailoredResumeButton
                jobId={job.id}
                companyName={job.company}
                hasResearch={!!job.company_research}
              />
            </div>
          </div>

          {/* Cover Letter */}
          <CoverLetterSection jobId={job.id} initialCoverLetter={job.cover_letter} hasAvatar={!!profileData?.avatar_url} />

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

function CompanyDossierDisplay({ dossier }: { dossier: CompanyDossier }) {
  return (
    <div className="flex flex-col gap-4">

      {/* Company Overview — full-width card */}
      {dossier.companyOverview && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TargetIcon className="w-4 h-4 text-accent shrink-0" />
            <p className="text-sm font-semibold text-text-primary">Company Overview</p>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{dossier.companyOverview}</p>
        </div>
      )}

      {/* Address & Contact Info */}
      {(dossier.companyAddress || dossier.contactInfo || dossier.recruiterContact) && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <PinIcon className="w-4 h-4 text-accent shrink-0" />
            <p className="text-sm font-semibold text-text-primary">Address &amp; Contact</p>
          </div>
          <div className="flex flex-col gap-3">
            {dossier.companyAddress && (
              <div className="flex items-start gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-text-muted w-20 shrink-0 mt-0.5">Address</span>
                <span className="text-sm text-text-primary">{dossier.companyAddress}</span>
              </div>
            )}
            {dossier.contactInfo && (dossier.contactInfo.name || dossier.contactInfo.email || dossier.contactInfo.phone) && (
              <>
                {(dossier.companyAddress || dossier.recruiterContact) && (
                  <div className="border-t border-border pt-3 mt-0">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Hiring Contact</p>
                  </div>
                )}
                <ContactRow label="Name" value={dossier.contactInfo.name} suffix={dossier.contactInfo.title} />
                <ContactRow label="Email" value={dossier.contactInfo.email} href={`mailto:${dossier.contactInfo.email}`} />
                <ContactRow label="Phone" value={dossier.contactInfo.phone} href={`tel:${dossier.contactInfo.phone}`} />
              </>
            )}
            {dossier.recruiterContact && (dossier.recruiterContact.name || dossier.recruiterContact.email || dossier.recruiterContact.phone) && (
              <>
                <div className="border-t border-border pt-3 mt-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">
                    Recruiter{dossier.recruiterContact.company ? ` · ${dossier.recruiterContact.company}` : ""}
                  </p>
                </div>
                <ContactRow label="Name" value={dossier.recruiterContact.name} suffix={dossier.recruiterContact.title} />
                <ContactRow label="Email" value={dossier.recruiterContact.email} href={`mailto:${dossier.recruiterContact.email}`} />
                <ContactRow label="Phone" value={dossier.recruiterContact.phone} href={`tel:${dossier.recruiterContact.phone}`} />
              </>
            )}
          </div>
        </div>
      )}

      {/* Tech Stack — pill tags with code icon */}
      {dossier.techStack.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-text-primary">Tech Stack</p>
          <div className="flex flex-wrap gap-2">
            {dossier.techStack.map((tech, i) => (
              <span
                key={i}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-muted text-accent rounded-full text-xs font-medium"
              >
                <CodeBracketIcon className="w-3 h-3 shrink-0" />
                {tech}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Culture + Your Edge — 2-column grid */}
      {(dossier.culture.length > 0 || dossier.yourEdge.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {dossier.culture.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <UsersIcon className="w-4 h-4 text-accent shrink-0" />
                <p className="text-sm font-semibold text-text-primary">Culture</p>
              </div>
              <ul className="flex flex-col gap-2">
                {dossier.culture.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dossier.yourEdge.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheckIcon className="w-4 h-4 text-success shrink-0" />
                <p className="text-sm font-semibold text-text-primary">Your Edge</p>
              </div>
              <ul className="flex flex-col gap-2">
                {dossier.yourEdge.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-success shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Gaps to Address + Smart Questions — 2-column grid */}
      {(dossier.gapsToAddress.length > 0 || dossier.smartQuestions.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {dossier.gapsToAddress.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <SlidersIcon className="w-4 h-4 text-accent shrink-0" />
                <p className="text-sm font-semibold text-text-primary">Gaps to Address</p>
              </div>
              <ul className="flex flex-col gap-2">
                {dossier.gapsToAddress.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {dossier.smartQuestions.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <HelpCircleIcon className="w-4 h-4 text-accent shrink-0" />
                <p className="text-sm font-semibold text-text-primary">Smart Questions</p>
              </div>
              <ul className="flex flex-col gap-2">
                {dossier.smartQuestions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Why This Role — full-width card */}
      {dossier.whyThisRole && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <LightbulbIcon className="w-4 h-4 text-warning shrink-0" />
            <p className="text-sm font-semibold text-text-primary">Why This Role</p>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{dossier.whyThisRole}</p>
        </div>
      )}

      {/* Interview Prep — full-width card */}
      {dossier.interviewPrep.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardIcon className="w-4 h-4 text-accent shrink-0" />
            <p className="text-sm font-semibold text-text-primary">Interview Prep</p>
          </div>
          <ul className="flex flex-col gap-2">
            {dossier.interviewPrep.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      {dossier.sources.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-3 border-t border-border">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Sources</p>
          <div className="flex flex-col gap-1">
            {dossier.sources.map((src, i) => (
              <a
                key={i}
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-muted hover:text-accent transition-colors truncate"
              >
                {src}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
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

function ContactRow({ label, value, suffix, href }: { label: string; value: string | null | undefined; suffix?: string | null; href?: string }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-muted w-20 shrink-0 mt-0.5">{label}</span>
      {href ? (
        <a href={href} className="text-sm text-accent hover:text-accent-dark transition-colors">
          {value}{suffix && <span className="text-text-muted"> · {suffix}</span>}
        </a>
      ) : (
        <span className="text-sm text-text-primary">
          {value}{suffix && <span className="text-text-muted"> · {suffix}</span>}
        </span>
      )}
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

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <line x1="8" y1="3" x2="8" y2="9" />
      <line x1="16" y1="9" x2="16" y2="15" />
      <line x1="12" y1="15" x2="12" y2="21" />
    </svg>
  );
}

function HelpCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" strokeWidth={2} />
    </svg>
  );
}

function CodeBracketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.5 4.5L2 8l3.5 3.5M10.5 4.5L14 8l-3.5 3.5M9 3.5l-2 9" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21h6M12 3a6 6 0 0 1 6 6c0 3.5-2.5 5.5-3 7H9c-.5-1.5-3-3.5-3-7a6 6 0 0 1 6-6z" />
      <path d="M9.5 16h5" />
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" />
    </svg>
  );
}
