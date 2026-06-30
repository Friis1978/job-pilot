import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createInsforgeServer } from "@/lib/insforge-server";
import { formatDateAgo, computeSkillYears, shortenLocation } from "@/lib/utils";
import { SalaryDisplay } from "@/components/find-jobs/SalaryDisplay";
import type { Profile, Connection } from "@/types";
import { Navbar } from "@/components/layout/Navbar";
import { ResearchButton } from "@/components/find-jobs/ResearchButton";
import { CoverLetterSection } from "@/components/find-jobs/CoverLetterSection";
import { TailoredResumeButton } from "@/components/find-jobs/TailoredResumeButton";
import { StatusBadge } from "@/components/find-jobs/StatusBadge";
import { RescoreButton } from "@/components/find-jobs/RescoreButton";
import { RegenerateDescriptionButton } from "@/components/find-jobs/RegenerateDescriptionButton";
import type { JobStatus } from "@/components/find-jobs/StatusBadge";
import { ContactSuggestion } from "@/components/network/ContactSuggestion";
import { getConnectionsForCompany, buildConnectionMap } from "@/lib/network-utils";

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
  experience_score: number | null;
  seniority_score: number | null;
  match_reason: string | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  company_research: Record<string, unknown> | null;
  description_summary: string | null;
  cover_letter: string | null;
  cover_letter_advice: string | null;
  tailored_summary: string | null;
  status: string;
  external_apply_url: string | null;
  found_at: string;
  source: string | null;
};

function formatSource(source: string | null): string {
  if (!source) return "—";
  const map: Record<string, string> = {
    adzuna: "Adzuna",
    jooble: "Jooble",
    jobtech: "JobTech",
    glassdoor: "Glassdoor",
    careerjet: "Careerjet",
    search: "Job search",
    url: "Imported",
  };
  return map[source.toLowerCase()] ?? source;
}

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

  const [profileResult, connectionsResult] = await Promise.allSettled([
    insforge.database
      .from("profiles")
      .select("work_experience, avatar_url, is_admin")
      .eq("id", user.id)
      .maybeSingle(),
    insforge.database
      .from("connections")
      .select("*")
      .eq("user_id", user.id),
  ]);

  const profileData = profileResult.status === "fulfilled" ? profileResult.value.data : null;
  const allConnections: Connection[] =
    connectionsResult.status === "fulfilled" ? (connectionsResult.value.data ?? []) : [];
  const connectionMap = buildConnectionMap(allConnections);
  const jobConnections = getConnectionsForCompany(job.company, connectionMap);

  const skillYears = computeSkillYears(
    (profileData as Pick<Profile, "work_experience"> | null)?.work_experience,
  );

  const matchColor = getMatchColor(job.match_score);

  const skillsScore = (() => {
    const matched = job.matched_skills?.length ?? 0;
    const missing = job.missing_skills?.length ?? 0;
    const total = matched + missing;
    if (total === 0) return job.match_score;
    return Math.round((matched / total) * 100);
  })();

  return (
    <>
      <Navbar user={{ name: userMeta?.full_name ?? userMeta?.name, email: user.email, avatarUrl: (profileData as { avatar_url?: string | null } | null)?.avatar_url ?? userMeta?.avatar_url }} isAdmin={(profileData as { is_admin?: boolean } | null)?.is_admin ?? false} />
      <main className="min-h-screen bg-background py-8">
        <div className="w-full max-w-360 mx-auto px-4 sm:px-6 pb-12 flex flex-col gap-5">

          {/* Back to Jobs */}
          <Link
            href="/find-jobs"
            className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors w-fit"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Back to Jobs
          </Link>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

            {/* ── LEFT COLUMN ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Job Header Card */}
              <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm flex items-start gap-4">
<div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-text-primary leading-tight">{job.title}</h1>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {job.company}
                    {job.location && <> &middot; {shortenLocation(job.location)}</>}
                    {job.job_type && <> &middot; {formatJobType(job.job_type)}</>}
                  </p>
                  {(job.matched_skills?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {job.matched_skills!.slice(0, 5).map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-1 bg-surface-secondary border border-border rounded-full text-xs font-medium text-text-secondary"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <MatchCircle score={job.match_score} colorClass={matchColor} />
                  <span className="text-xs text-text-muted">Match score</span>
                </div>
              </div>

              {/* Match Breakdown */}
              {((job.matched_skills?.length ?? 0) > 0 ||
                (job.missing_skills?.length ?? 0) > 0) && (
                <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      Match Breakdown
                    </p>
                    <RescoreButton jobId={job.id} />
                  </div>

                  {/* Progress bars */}
                  <div className="flex flex-col gap-3 mb-6">
                    <ProgressBar label="Skills" value={skillsScore} barColor="bg-success" textColor="text-success" />
                    <ProgressBar label="Experience" value={job.experience_score ?? job.match_score} barColor="bg-info-medium" textColor="text-info-medium" />
                    <ProgressBar label="Seniority" value={job.seniority_score ?? job.match_score} barColor="bg-success" textColor="text-success" />
                  </div>

                  {/* Matched / Missing skills stacked */}
                  <div className="flex flex-col gap-5 pt-5 border-t border-border">
                    {(job.matched_skills?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">
                          Matched Skills
                        </p>
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
                                className="px-3 py-1 bg-success-lightest text-success-foreground rounded-full text-sm font-medium"
                              >
                                {skill}
                                {yrs != null && (
                                  <span className="opacity-70 font-normal"> · {yrs}yr</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {(job.missing_skills?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-3">
                          Missing Skills
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {job.missing_skills!.map((skill) => (
                            <span
                              key={skill}
                              className="px-3 py-1 bg-error/10 text-error rounded-full text-sm font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Job Description */}
              {(job.description_summary || job.about_role) && (
                <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                    <DocIcon className="w-5 h-5 text-text-muted shrink-0" />
                    <h2 className="flex-1 text-base font-semibold text-text-primary">
                      Job Description
                    </h2>
                    <RegenerateDescriptionButton jobId={job.id} hasSummary={!!job.description_summary} />
                  </div>
                  <div className="bg-surface-tertiary p-5 flex flex-col gap-4">
                    {(() => {
                      const raw = job.description_summary ?? job.about_role ?? "";
                      const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => l.replace(/^[•\-\*]\s*/, ""));
                      if (lines.length > 1) {
                        return (
                          <ul className="flex flex-col gap-2">
                            {lines.map((text, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-text-primary leading-relaxed">
                                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                {text}
                              </li>
                            ))}
                          </ul>
                        );
                      }
                      return <p className="text-sm text-text-primary leading-relaxed">{raw}</p>;
                    })()}
                    {job.external_apply_url && (
                      <a
                        href={job.external_apply_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start flex items-center gap-1.5 py-3 px-4 bg-surface border border-border-muted text-text-primary rounded-xl text-sm font-bold underline hover:bg-surface-secondary transition-colors"
                      >
                        Full posting
                        <ExternalLinkIcon className="w-3.5 h-3.5 no-underline" />
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Contacts to Reach Out To */}
              {jobConnections.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
                  <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
                    <NetworkIcon className="w-5 h-5 text-text-muted shrink-0" />
                    <h2 className="flex-1 text-base font-semibold text-text-primary">
                      Contacts to reach out to
                    </h2>
                  </div>
                  <div className="bg-surface-tertiary p-5">
                    <ContactSuggestion jobTitle={job.title} company={job.company} connections={jobConnections} />
                  </div>
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

                <div className="bg-surface-tertiary p-5">
                  {job.company_research ? (
                    <CompanyDossierDisplay
                      dossier={job.company_research as unknown as CompanyDossier}
                    />
                  ) : (
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

              {/* Cover Letter */}
              <div id="cover-letter">
                <CoverLetterSection jobId={job.id} initialCoverLetter={job.cover_letter} initialAdvice={job.cover_letter_advice} hasAvatar={!!profileData?.avatar_url} tailoredSummary={job.tailored_summary} />
              </div>

            </div>

            {/* ── RIGHT SIDEBAR ────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 lg:sticky lg:top-8">

              {/* Main card: buttons + details */}
              <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm flex flex-col gap-2">

                {/* Apply Now */}
                {job.external_apply_url ? (
                  <a
                    href={job.external_apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-1.5 py-3 bg-accent text-accent-foreground rounded-xl text-sm font-bold underline hover:bg-accent-dark transition-colors"
                  >
                    Apply now
                    <span className="no-underline">↗</span>
                  </a>
                ) : (
                  <div className="w-full flex items-center justify-center py-3 border border-border rounded-xl text-sm font-medium text-text-muted cursor-not-allowed">
                    No job link available
                  </div>
                )}

                {/* Download Tailored Resume */}
                <TailoredResumeButton
                  jobId={job.id}
                  companyName={job.company}
                  hasResearch={!!job.company_research}
                  fullWidth
                />

                {/* Separator */}
                <div className="h-px bg-border-muted mx-1 my-1" />

                {/* Job Details */}
                <div className="flex flex-col">
                  <DetailRow label="Source" value={formatSource(job.source)} />
                  <DetailRow label="Posted" value={formatDateAgo(job.found_at)} />
                  <DetailRow label="Contract" value={formatJobType(job.job_type)} />
                  <DetailRow label="Salary" value={<SalaryDisplay salary={job.salary} />} />
                  <div className="flex items-center justify-between py-2.5">
                    <span className="text-xs font-medium text-text-muted">Status</span>
                    <StatusBadge jobId={job.id} status={(job.status as JobStatus) ?? "saved"} />
                  </div>
                </div>

              </div>

              {/* AI Match Summary */}
              {job.match_reason && (
                <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <SparkleIcon className="w-4 h-4 text-success shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      AI Match Summary
                    </span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {job.match_reason}
                  </p>
                </div>
              )}



            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function ProgressBar({
  label,
  value,
  barColor,
  textColor,
}: {
  label: string;
  value: number;
  barColor: string;
  textColor: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-sm text-text-secondary shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className={`w-9 text-sm font-semibold text-right shrink-0 ${textColor}`}>
        {value}%
      </span>
    </div>
  );
}

function MatchCircle({ score, colorClass }: { score: number; colorClass: string }) {
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const lightBg =
    colorClass === "text-success" ? "bg-success-lightest" :
    colorClass === "text-info-medium" ? "bg-info-lightest" :
    "bg-warning/10";

  return (
    <div className="relative flex items-center justify-center w-18 h-18 shrink-0">
      <svg className="w-18 h-18 -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={radius} fill="none" strokeWidth="5" stroke="currentColor" className="text-border" />
        <circle
          cx="36" cy="36" r={radius} fill="none"
          strokeWidth="5" stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={colorClass}
        />
      </svg>
      <div className={`absolute w-[51px] h-[51px] rounded-full ${lightBg}`} />
      <div className="absolute flex flex-col items-center">
        <span className={`text-base font-bold leading-none ${colorClass}`}>{score}%</span>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
      <span className="text-xs font-medium text-text-muted shrink-0">{label}</span>
      <span className="text-xs font-medium text-text-primary text-right max-w-[180px]">{value}</span>
    </div>
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

      {/* Tech Stack */}
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

      {/* Culture + Your Edge */}
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

      {/* Gaps to Address + Smart Questions */}
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

      {/* Why This Role */}
      {dossier.whyThisRole && (
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <LightbulbIcon className="w-4 h-4 text-warning shrink-0" />
            <p className="text-sm font-semibold text-text-primary">Why This Role</p>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{dossier.whyThisRole}</p>
        </div>
      )}

      {/* Interview Prep */}
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

function NetworkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 15 15" fill="none" aria-hidden className={className ?? "shrink-0"}>
      <circle cx="7.5" cy="4.5" r="2.25" fill="currentColor" />
      <circle cx="2.5" cy="9" r="1.75" fill="currentColor" opacity="0.7" />
      <circle cx="12.5" cy="9" r="1.75" fill="currentColor" opacity="0.7" />
      <path d="M1 14c0-1.1.67-2 1.5-2s1.5.9 1.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M14 14c0-1.1-.67-2-1.5-2S11 12.9 11 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M5 14c0-1.38 1.12-2.5 2.5-2.5S10 12.62 10 14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

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

function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-8-6.895-8-12a8 8 0 1116 0c0 5.105-8 12-8 12z" />
      <circle cx="12" cy="9" r="2.5" />
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
