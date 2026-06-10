import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { searchJobs } from "@/lib/adzuna";
import { MATCH_THRESHOLD } from "@/lib/utils";
import type { Profile, AdzunaJob, ScoredJob } from "@/types";

type ScoringResult = ScoredJob & { job: AdzunaJob };

type FindJobsResult = {
  success: boolean;
  jobsFound?: number;
  jobsSaved?: number;
  error?: string;
};

function detectCountry(location: string): string {
  const loc = location.toLowerCase();
  if (
    /\buk\b|united kingdom|england|scotland|wales|london|manchester|birmingham/.test(
      loc,
    )
  )
    return "gb";
  if (/australia|sydney|melbourne|brisbane|perth/.test(loc)) return "au";
  if (/canada|toronto|vancouver|montreal|calgary/.test(loc)) return "ca";
  return "us";
}

async function scoreJob(
  job: AdzunaJob,
  profile: Profile,
  openai: OpenAI,
): Promise<ScoringResult | null> {
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
}`,
        },
        {
          role: "user",
          content: `JOB:
Title: ${job.title}
Company: ${job.company.display_name}
Location: ${job.location.display_name}
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
    const country = detectCountry(location);
    const adzunaJobs = await searchJobs(jobTitle, location, country);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const scoringResults = await Promise.all(
      adzunaJobs.map((job) => scoreJob(job, profile, openai)),
    );

    const qualifyingJobs = scoringResults.filter(
      (r): r is ScoringResult => r !== null && r.matchScore >= MATCH_THRESHOLD,
    );

    if (qualifyingJobs.length > 0) {
      const jobRecords = qualifyingJobs.map((r) => ({
        user_id: userId,
        run_id: runId,
        source: "search",
        source_url: r.job.redirect_url,
        external_apply_url: r.job.redirect_url,
        title: r.job.title,
        company: r.job.company.display_name,
        location: r.job.location.display_name,
        salary:
          r.job.salary_min && r.job.salary_max
            ? `$${Math.round(r.job.salary_min / 1000)}k - $${Math.round(r.job.salary_max / 1000)}k`
            : r.job.salary_min
              ? `$${Math.round(r.job.salary_min / 1000)}k+`
              : null,
        job_type: r.job.contract_type ?? "fulltime",
        about_role: r.job.description,
        match_score: r.matchScore,
        match_reason: r.matchReason,
        matched_skills: r.matchedSkills,
        missing_skills: r.missingSkills,
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
          properties: { userId, source: "search", matchScore: r.matchScore },
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
      jobsFound: adzunaJobs.length,
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
