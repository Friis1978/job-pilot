import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { searchJobs } from "@/lib/adzuna";
import { searchJobsSweden } from "@/lib/jobtech";
import { searchJobsJooble } from "@/lib/jooble";
import { searchJobsCareerjet } from "@/lib/careerjet";
import { searchJobsLinkedIn } from "@/lib/linkedin-jobs";
import { MATCH_THRESHOLD, stripHtml } from "@/lib/utils";
import type { Profile, AdzunaJob, NormalizedJob, ScoredJob } from "@/types";

type ScoringResult = ScoredJob & { job: NormalizedJob };

type FindJobsResult = {
  success: boolean;
  jobsFound?: number;
  jobsSaved?: number;
  error?: string;
};

type JobSource = "adzuna" | "jobtech" | "jooble" | "careerjet" | "linkedin";

function detectSources(location: string): {
  sources: JobSource[];
  adzunaCountry: string;
} {
  const loc = location.toLowerCase();
  if (
    /\bse\b|sweden|sverige|stockholm|gothenburg|g[öo]teborg|malm[öo]|uppsala|v[äa]ster[åa]s|[öo]rebro|link[öo]ping|helsingborg|norrk[öo]ping/.test(
      loc,
    )
  ) {
    return { sources: ["jobtech", "jooble", "linkedin"], adzunaCountry: "se" };
  }
  if (
    /\bdk\b|denmark|danmark|copenhagen|k[øo]benhavn|aarhus|[åa]rhus|odense|aalborg/.test(
      loc,
    )
  ) {
    return { sources: ["careerjet", "jooble", "linkedin"], adzunaCountry: "dk" };
  }
  if (
    /\buk\b|united kingdom|england|scotland|wales|london|manchester|birmingham/.test(
      loc,
    )
  ) {
    return { sources: ["adzuna"], adzunaCountry: "gb" };
  }
  if (/australia|sydney|melbourne|brisbane|perth/.test(loc)) {
    return { sources: ["adzuna"], adzunaCountry: "au" };
  }
  if (/canada|toronto|vancouver|montreal|calgary/.test(loc)) {
    return { sources: ["adzuna"], adzunaCountry: "ca" };
  }
  return { sources: ["adzuna"], adzunaCountry: "us" };
}

function normalizeAdzunaJob(job: AdzunaJob): NormalizedJob {
  return {
    id: job.id,
    title: job.title,
    company: job.company.display_name,
    location: job.location.display_name,
    description: stripHtml(job.description),
    url: job.redirect_url,
    salary:
      job.salary_min && job.salary_max
        ? `$${Math.round(job.salary_min / 1000)}k - $${Math.round(job.salary_max / 1000)}k`
        : job.salary_min
          ? `$${Math.round(job.salary_min / 1000)}k+`
          : null,
    job_type: job.contract_type ?? null,
    source: "adzuna",
  };
}

export async function scoreJob(
  job: NormalizedJob,
  profile: Profile,
  openai: OpenAI,
  searchedLocation: string,
): Promise<ScoringResult | null> {
  const locationRule = searchedLocation
    ? `- Location rule: The candidate is searching for jobs in "${searchedLocation}". If the job location does not match — and the job does not explicitly allow remote work — set matchScore to 0.`
    : "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `You are a job matching assistant. Score how well a job posting matches a candidate's profile.
Return ONLY valid JSON with this exact shape:
{
  "matchScore": <integer 0-100>,
  "matchReason": "<one paragraph explaining the match quality>",
  "matchedSkills": ["<skill the candidate has that the job requires>"],
  "missingSkills": ["<skill the job requires that the candidate lacks>"]
}

Scoring rules:
- Be strict and realistic. A high score (80+) requires the job description to explicitly mention requirements that match the candidate's skills and experience level.
- If the job description is a short snippet (under 100 words) without specific requirements, technologies, or experience criteria, set matchScore to 50 or below — there is not enough information to justify a high score.
- Never infer requirements that are not stated. Missing information is a signal to score lower, not higher.
- A mismatch in seniority, domain, or core technology stack should significantly reduce the score.${locationRule ? `\n${locationRule}` : ""}`,
        },
        {
          role: "user",
          content: `JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description}

CANDIDATE:
Current title: ${profile.current_title ?? "Not specified"}
Experience: ${profile.years_experience ?? 0} years, ${profile.experience_level ?? "Not specified"}
Skills: ${profile.skills?.join(", ") ?? "Not specified"}
Recent work: ${JSON.stringify(
            profile.work_experience
              ?.slice(0, 2)
              .map((w) => ({ title: w.title, company: w.company })) ?? [],
          )}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const scored = JSON.parse(raw) as ScoredJob;
    return { ...scored, job };
  } catch {
    console.error(`[agent/find-jobs] scoring failed for job ${job.id}`);
    return null;
  }
}

export async function findJobs(
  userId: string,
  jobTitle: string,
  location: string,
  minScore: number = MATCH_THRESHOLD,
): Promise<FindJobsResult> {
  const insforge = await createInsforgeServer();

  const { data: profileData, error: profileError } = await insforge.database
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    return {
      success: false,
      error:
        "Profile not found. Please complete your profile before searching for jobs.",
    };
  }

  const profile = profileData as Profile;

  const posthog = getPostHogClient();
  posthog.capture({
    distinctId: userId,
    event: "job_search_started",
    properties: { userId, jobTitle, location },
  });

  const { data: runData, error: runError } = await insforge.database
    .from("agent_runs")
    .insert([
      {
        user_id: userId,
        status: "running",
        job_title_searched: jobTitle,
        location_searched: location,
      },
    ])
    .select()
    .single();

  if (runError || !runData) {
    console.error("[agent/find-jobs] failed to create agent_run", runError);
    await posthog.shutdown();
    return { success: false, error: "Something went wrong. Please try again." };
  }

  const runId = (runData as { id: string }).id;

  try {
    const { sources, adzunaCountry } = detectSources(location);

    const fetches: Promise<NormalizedJob[]>[] = [];

    if (sources.includes("adzuna")) {
      fetches.push(
        searchJobs(jobTitle, location, adzunaCountry).then((jobs) =>
          jobs.map(normalizeAdzunaJob),
        ),
      );
    }
    if (sources.includes("jobtech")) {
      fetches.push(searchJobsSweden(jobTitle));
    }
    if (sources.includes("jooble")) {
      fetches.push(searchJobsJooble(jobTitle, location));
    }
    if (sources.includes("careerjet")) {
      fetches.push(searchJobsCareerjet(jobTitle, location));
    }
    if (sources.includes("linkedin")) {
      // LinkedIn location_filter uses full country name e.g. "Denmark" or "Sweden"
      const linkedInLocation = /sweden|sverige|stockholm|g[öo]teborg|malm[öo]/i.test(location)
        ? "Sweden"
        : "Denmark";
      fetches.push(searchJobsLinkedIn(jobTitle, linkedInLocation));
    }

    const settled = await Promise.allSettled(fetches);

    // Log any source failures but continue with whatever succeeded
    settled.forEach((result, i) => {
      if (result.status === "rejected") {
        console.error(
          `[agent/find-jobs] source ${sources[i]} failed:`,
          result.reason,
        );
      }
    });

    const allJobs = settled
      .filter(
        (r): r is PromiseFulfilledResult<NormalizedJob[]> =>
          r.status === "fulfilled",
      )
      .flatMap((r) => r.value);

    // Deduplicate against existing jobs for this user
    const { data: existingJobs } = await insforge.database
      .from("jobs")
      .select("source_url, title, company")
      .eq("user_id", userId);

    const existingUrls = new Set(
      (existingJobs ?? []).map((j: { source_url: string }) => j.source_url),
    );
    const existingTitleCompany = new Set(
      (existingJobs ?? []).map(
        (j: { title: string; company: string }) =>
          `${j.title.toLowerCase()}|${j.company.toLowerCase()}`,
      ),
    );

    const newJobs = allJobs.filter(
      (job) =>
        !existingUrls.has(job.url) &&
        !existingTitleCompany.has(
          `${job.title.toLowerCase()}|${job.company.toLowerCase()}`,
        ),
    );

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const scoringResults = await Promise.all(
      newJobs.map((job) => scoreJob(job, profile, openai, location)),
    );

    const qualifyingJobs = scoringResults.filter(
      (r): r is ScoringResult => r !== null && r.matchScore >= minScore,
    );

    if (qualifyingJobs.length > 0) {
      const jobRecords = qualifyingJobs.map((r) => ({
        user_id: userId,
        run_id: runId,
        source: "search",
        source_url: r.job.url,
        external_apply_url: r.job.url,
        title: r.job.title,
        company: r.job.company,
        location: r.job.location,
        salary: r.job.salary ?? null,
        job_type: r.job.job_type ?? "fulltime",
        about_role: r.job.description,
        match_score: r.matchScore,
        match_reason: r.matchReason,
        matched_skills: r.matchedSkills,
        missing_skills: r.missingSkills,
        status: "saved",
        found_at: new Date().toISOString(),
      }));

      const { error: insertError } = await insforge.database
        .from("jobs")
        .insert(jobRecords);

      if (insertError) {
        console.error("[agent/find-jobs] failed to insert jobs", insertError);
        await insforge.database
          .from("agent_runs")
          .update({ status: "failed" })
          .eq("id", runId)
          .eq("user_id", userId);
        await posthog.shutdown();
        return {
          success: false,
          error: "Jobs were found but could not be saved. Please try again.",
        };
      }

      qualifyingJobs.forEach((r) => {
        posthog.capture({
          distinctId: userId,
          event: "job_found",
          properties: {
            userId,
            source: r.job.source,
            matchScore: r.matchScore,
          },
        });
      });
    }

    await insforge.database
      .from("agent_runs")
      .update({ status: "complete", jobs_found: qualifyingJobs.length })
      .eq("id", runId)
      .eq("user_id", userId);

    await posthog.shutdown();

    return {
      success: true,
      jobsFound: allJobs.length,
      jobsSaved: qualifyingJobs.length,
    };
  } catch (err) {
    console.error("[agent/find-jobs]", err);
    await insforge.database
      .from("agent_runs")
      .update({ status: "failed" })
      .eq("id", runId)
      .eq("user_id", userId);
    await posthog.shutdown();
    return { success: false, error: "Something went wrong. Please try again." };
  }
}
