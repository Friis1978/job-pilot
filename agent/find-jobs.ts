import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { searchJobs } from "@/lib/adzuna";
import { searchJobsSweden } from "@/lib/jobtech";
import { searchJobsJooble } from "@/lib/jooble";
import { searchJobsCareerjet } from "@/lib/careerjet";
import { searchJobsGlassdoor } from "@/lib/glassdoor";
import { MATCH_THRESHOLD, stripHtml, computeSkillYears, getLocationAliases } from "@/lib/utils";
import type { Profile, AdzunaJob, NormalizedJob, ScoredJob } from "@/types";

type ScoringResult = ScoredJob & { job: NormalizedJob };

// Follow the job URL redirect and extract the full description from the employer's own page.
// Jooble and Careerjet only return short snippets; the real posting often has contact persons,
// "About us" sections, and requirements that are critical for scoring and research.
// Always follows the redirect to resolve tracking URLs (e.g. jobviewtrack.com) to the real
// employer page — even when the description is already long enough to skip enrichment.
async function enrichJobDescription(job: NormalizedJob): Promise<NormalizedJob> {
  try {
    const res = await fetch(job.url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "da-DK,da;q=0.9,en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return job;

    // Skip if we're still on a job aggregator or tracking domain
    const finalHost = new URL(res.url).hostname;
    const AGGREGATOR_DOMAINS = [
      "careerjet", "jooble", "jobviewtrack", "glassdoor", "adzuna",
      "linkedin", "indeed", "jobindex", "stepstone", "monster",
    ];
    const isAggregator = AGGREGATOR_DOMAINS.some((d) => finalHost.includes(d));

    const improved: NormalizedJob = { ...job };
    // Always capture the resolved employer URL — replaces tracking/redirect links
    if (res.url !== job.url && !isAggregator) {
      improved.url = res.url;
    }

    // Skip description enrichment if already has enough content or landed on aggregator
    if (job.description.length > 300 || isAggregator) {
      return improved;
    }

    const html = await res.text();

    // Skip bot-check pages
    if (/bekræftelse påkrævet|checking your browser|just a moment|enable javascript to/i.test(html)) {
      return improved;
    }

    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 6000);

    if (text.length > job.description.length + 200) {
      improved.description = text;
    }
    return improved;
  } catch {
    return job; // Enrichment failed — keep original snippet
  }
}

type FindJobsResult = {
  success: boolean;
  jobsFound?: number;
  jobsSaved?: number;
  error?: string;
};

type JobSource = "adzuna" | "jobtech" | "jooble" | "careerjet" | "glassdoor";

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
    return { sources: ["jobtech", "jooble", "glassdoor"], adzunaCountry: "se" };
  }
  if (
    /\bdk\b|denmark|danmark|copenhagen|k[øo]benhavn|aarhus|[åa]rhus|odense|aalborg/.test(
      loc,
    )
  ) {
    return { sources: ["careerjet", "jooble", "glassdoor"], adzunaCountry: "dk" };
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
  const isRemoteSearch = /^remote$/i.test(searchedLocation.trim());
  let locationRule: string;
  if (searchedLocation) {
    locationRule = isRemoteSearch
      ? `- Location rule: The candidate is specifically looking for remote jobs. If the job does not explicitly offer remote work, set matchScore to 0.`
      : `- Location rule: The candidate is searching for onsite jobs in "${searchedLocation}". If the job location does not match this location, set matchScore to 0 — this includes fully remote jobs, which do not satisfy an onsite location search.`;
  } else {
    // No search location — fall back to profile preferences
    const pref = profile.remote_preference?.toLowerCase();
    const locs = profile.preferred_locations?.filter(Boolean) ?? [];
    if (pref === "remote") {
      locationRule = `- Location rule: The candidate strongly prefers fully remote work. If the job is onsite-only with no remote option, cap matchScore at 30. If the job is hybrid or remote-friendly, no penalty.`;
    } else if (pref === "onsite" && locs.length > 0) {
      locationRule = `- Location rule: The candidate strongly prefers onsite work in or near ${locs.map((l) => `"${l}"`).join(" or ")} (including suburbs and towns within commuting distance, e.g. towns in the greater ${locs[0]} metropolitan area). If the job is in a completely different region or country — clearly not within daily commuting distance of ${locs.join(", ")} — cap matchScore at 35. If the job is fully remote with no onsite option near the candidate's preferred location, cap matchScore at 40. Do NOT penalise jobs in nearby towns or suburbs.`;
    } else if (pref === "hybrid" && locs.length > 0) {
      locationRule = `- Location rule: The candidate prefers hybrid work in or near ${locs.map((l) => `"${l}"`).join(" or ")} (including suburbs and towns within commuting distance). If the job is onsite-only in a completely different region or country, cap matchScore at 40. Fully remote jobs are acceptable. Hybrid or remote jobs near ${locs.join(" or ")} are ideal.`;
    } else {
      locationRule = "";
    }
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are a job matching assistant. Score how well a job posting matches a candidate's profile.
Return ONLY valid JSON with this exact shape:
{
  "matchScore": <integer 0-100>,
  "matchReason": "<one paragraph explaining the match quality>",
  "matchedSkills": ["<every skill from the candidate's list that appears or is implied in the job description>"],
  "missingSkills": ["<skill the job explicitly requires that the candidate does not have>"]
}

Language note: Job descriptions may be written in any language — Danish, Swedish, Norwegian, German, or others. Technical skill names (TypeScript, Vue.js, React, Nuxt, Node.js, Python, etc.) appear in English even inside non-English text. Read the full description regardless of language and match skills by their English name.

Skill matching rules:
- matchedSkills must include EVERY skill from the candidate's profile that is explicitly named in the job description, or is a direct alias/variant of an explicitly named technology (e.g. "Tailwind" matches "Tailwind CSS"; "React Hooks" matches if "React" is named; "Node" matches "Node.js"; "Vue" matches "Vue 3"). Be exhaustive — do not skip skills that genuinely match.
- A direct alias means a more specific or shortened form of the SAME technology. Word similarity alone is NOT a match: "graphing platform" does not match "GraphQL", "scripting" does not match "TypeScript". The technology name itself must appear.
- Do NOT include a skill just because it is commonly associated with a mentioned technology. If the job says "Azure" but not "Docker", do not add "Docker".
- missingSkills should only include skills the job explicitly names as requirements or nice-to-haves that the candidate does not have.
- Do not add skills to either list that aren't grounded in both the job description and the candidate's profile.

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
Skills: ${profile.skills?.join(", ") ?? "Not specified"}${(() => {
              const sy = computeSkillYears(profile.work_experience);
              const entries = Object.entries(sy).sort((a, b) => b[1] - a[1]);
              return entries.length > 0
                ? `\nSkill experience (years): ${entries.map(([s, y]) => `${s} ${y}yr`).join(", ")}`
                : "";
            })()}
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
      const aliases = getLocationAliases(location);
      fetches.push(
        Promise.all(aliases.map((loc) => searchJobsJooble(jobTitle, loc))).then((results) => {
          const seen = new Set<string>();
          return results.flat().filter((j) => { if (seen.has(j.url)) return false; seen.add(j.url); return true; });
        }),
      );
    }
    if (sources.includes("careerjet")) {
      const aliases = getLocationAliases(location);
      fetches.push(
        Promise.all(aliases.map((loc) => searchJobsCareerjet(jobTitle, loc))).then((results) => {
          const seen = new Set<string>();
          return results.flat().filter((j) => { if (seen.has(j.url)) return false; seen.add(j.url); return true; });
        }),
      );
    }
    if (sources.includes("glassdoor")) {
      const glassdoorLocation = /sweden|sverige|stockholm|g[öo]teborg|malm[öo]/i.test(location)
        ? "Sweden"
        : "Denmark";
      fetches.push(searchJobsGlassdoor(jobTitle, glassdoorLocation));
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

    // Enrich short-snippet jobs (Jooble, Careerjet) by following the redirect URL
    // and fetching the full description from the employer's own page, in parallel.
    const enrichedJobs = await Promise.all(newJobs.map(enrichJobDescription));

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const scoringResults = await Promise.all(
      enrichedJobs.map((job) => scoreJob(job, profile, openai, location)),
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
