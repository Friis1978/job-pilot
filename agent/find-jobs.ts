import * as Sentry from "@sentry/nextjs";
import OpenAI from "openai";
import { Stagehand } from "@browserbasehq/stagehand";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { searchJobs } from "@/lib/adzuna";
import { searchJobsSweden } from "@/lib/jobtech";
import { searchJobsJooble } from "@/lib/jooble";
import { searchJobsCareerjet } from "@/lib/careerjet";
import { searchJobsGlassdoor } from "@/lib/glassdoor";
import { browserbase } from "@/lib/browserbase";
import { MATCH_THRESHOLD, stripHtml, computeSkillYears, getLocationAliases, normalizeLocationToEnglish } from "@/lib/utils";
import type { Profile, AdzunaJob, NormalizedJob, ScoredJob, PersonalProject } from "@/types";

type ScoringResult = ScoredJob & { job: NormalizedJob };

const AGGREGATOR_DOMAINS = [
  "careerjet", "jooble", "jobviewtrack", "glassdoor", "adzuna",
  "linkedin", "indeed", "jobindex", "stepstone", "monster",
];

/**
 * Resolves jobviewtrack.com redirect URLs to the final employer page URL.
 * jobviewtrack requires the Careerjet `Referer` header to follow the redirect chain;
 * without it the server loops back to the Careerjet listing. Returns the original
 * URL unchanged if resolution fails or lands on another aggregator.
 */
async function resolveTrackingUrl(url: string): Promise<string> {
  if (!url.includes("jobviewtrack")) return url;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "da-DK,da;q=0.9,en-US,en;q=0.5",
        "Referer": "https://www.careerjet.dk/",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return url;
    const finalHost = new URL(res.url).hostname;
    // Only accept the resolved URL if it landed on an employer page
    if (!AGGREGATOR_DOMAINS.some((d) => finalHost.includes(d))) {
      return res.url;
    }
  } catch {
    // Resolution failed — keep original
  }
  return url;
}

/**
 * Fetches the employer's own job page to replace the short aggregator snippet with
 * the full posting text. Also updates `job.url` to the permanent employer URL when
 * a redirect is followed. Skips non-aggregator jobs that already have a long description.
 */
async function enrichJobDescription(job: NormalizedJob): Promise<NormalizedJob> {
  // Resolve tracking/redirect URLs before enrichment so the saved URL is permanent
  const resolvedUrl = await resolveTrackingUrl(job.url);
  const improved: NormalizedJob = resolvedUrl !== job.url ? { ...job, url: resolvedUrl } : { ...job };

  // Always try to enrich jobs from aggregators (Careerjet, Jooble, jobviewtrack) —
  // their descriptions are snippets that miss contact sections, requirements, and culture.
  // For non-aggregator sources, skip if already has enough content.
  const isFromAggregator = AGGREGATOR_DOMAINS.some((d) => job.url.includes(d));
  if (!isFromAggregator && job.description.length > 300) {
    return improved;
  }

  try {
    const res = await fetch(improved.url, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "da-DK,da;q=0.9,en-US,en;q=0.5",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return improved;

    const finalHost = new URL(res.url).hostname;
    const isAggregator = AGGREGATOR_DOMAINS.some((d) => finalHost.includes(d));

    // Capture any further redirect that happened during description fetch
    if (res.url !== improved.url && !isAggregator) {
      improved.url = res.url;
    }

    if (isAggregator) return improved;

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
      .trim();

    // Use the full text — no truncation so contact sections at the bottom are never lost
    if (text.length > job.description.length + 200) {
      improved.description = text;
    }
    return improved;
  } catch {
    return improved; // Enrichment failed — keep resolved URL but original snippet
  }
}

/**
 * For aggregator jobs that still have short descriptions after HTTP enrichment
 * (e.g. Careerjet is Cloudflare-protected), open a single real browser session
 * via Browserbase and visit each URL sequentially to extract the full page text.
 * Returns a map of job.id → full text for jobs that were successfully enriched.
 */
async function browserEnrichJobs(jobs: NormalizedJob[]): Promise<Map<string, string>> {
  if (!process.env.BROWSERBASE_PROJECT_ID || !process.env.BROWSERBASE_API_KEY) {
    return new Map();
  }

  const toEnrich = jobs.filter(
    (j) =>
      AGGREGATOR_DOMAINS.some((d) => j.url.includes(d)) &&
      j.description.length < 1000,
  );
  if (toEnrich.length === 0) return new Map();

  const results = new Map<string, string>();
  let stagehand: Stagehand | null = null;
  let sessionId: string | null = null;
  try {
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      timeout: 180,
    });
    sessionId = session.id;
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      browserbaseSessionID: sessionId,
      model: { modelName: "gpt-4o", apiKey: process.env.OPENAI_API_KEY! },
      disablePino: true,
    });
    await stagehand.init();
    const page = stagehand.context.activePage()!;

    for (const job of toEnrich.slice(0, 3)) {
      try {
        // Use "load" instead of "networkidle" — Careerjet loads tracking scripts
        // that keep the network busy and can cause networkidle to time out.
        await page.goto(job.url, { waitUntil: "load", timeoutMs: 15000 });
        const innerText = await page.evaluate(() => {
          // Prefer the main content area to exclude nav, footer, and similar-jobs noise
          const main = document.querySelector<HTMLElement>(
            "main, [role='main'], article",
          );
          return (main ?? document.body).innerText;
        });
        const text = (typeof innerText === "string" ? innerText : "")
          .replace(/\s+/g, " ")
          .trim();
        if (text.length > job.description.length + 200) {
          results.set(job.id, text);
        }
      } catch {
        // Skip this job if browser navigation fails — try the next one
      }
    }
  } catch (err) {
    console.error("[agent/find-jobs] browser enrichment failed:", err);
  } finally {
    if (stagehand) {
      await stagehand.close().catch(() => null);
    } else if (sessionId) {
      await browserbase.sessions
        .update(sessionId, { status: "REQUEST_RELEASE" })
        .catch(() => null);
    }
  }
  return results;
}

type FindJobsResult = {
  success: boolean;
  jobsFound?: number;
  jobsSaved?: number;
  jobsSkipped?: number;
  error?: string;
};

type JobSource = "adzuna" | "jobtech" | "jooble" | "careerjet" | "glassdoor";

/**
 * Selects which job-board APIs to query and which Adzuna country code to use
 * based on the searched location string. Defaults to US sources when no
 * recognised country or city pattern is found.
 */
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
    return { sources: ["adzuna", "careerjet", "jooble", "glassdoor"], adzunaCountry: "dk" };
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

/**
 * Extracts a salary/compensation string from raw job description text.
 * Looks for labelled patterns first ("Compensation Range:", "Salary:"), then
 * unlabelled currency+range patterns. Returns null if nothing is found.
 */
export function extractSalaryFromText(text: string): string | null {
  if (!text) return null;
  const patterns = [
    // Labelled: "Compensation Range: €56K–€70K", "Salary: 500,000–700,000 DKK"
    /(?:compensation\s+range|salary(?:\s+range)?|løn(?:\s+range)?|pay)\s*:?\s*((?:[€$£]|DKK|SEK|NOK|EUR|USD|GBP)?\s*\d[\d\s,\.]*[kKmM]?\s*[-–]\s*(?:[€$£]|DKK|SEK|NOK|EUR|USD|GBP)?\s*\d[\d\s,\.]*[kKmM]?(?:\s*(?:EUR|DKK|SEK|NOK|GBP|USD|kr))?)/i,
    // Unlabelled: "700k–850k DKK", "€56K–€70K", "$80,000–$100,000"
    /((?:[€$£])\d[\d\s,\.]*[kKmM]?\s*[-–]\s*(?:[€$£])\d[\d\s,\.]*[kKmM]?(?:\s*(?:EUR|DKK|SEK|NOK|GBP|USD))?)/,
    /(\d[\d\s,\.]*[kKmM]?\s*[-–]\s*\d[\d\s,\.]*[kKmM]?\s*(?:EUR|DKK|SEK|NOK|GBP|USD|kr)\b)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/\s+/g, " ");
  }
  return null;
}

/**
 * Generates a concise 8–10 bullet-point summary of a job description using
 * gpt-4o-mini. Returns `null` for short descriptions (< 500 chars) or on error.
 */
export async function summarizeDescription(description: string, openai: OpenAI): Promise<string | null> {
  if (!description || description.length < 500) return null;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: `Summarize this job description as exactly 8–10 bullet points. Each bullet must be a full, informative sentence — not a fragment. Cover all of these areas (one or two bullets each):
1. What the company does and its context
2. What the role is and who it reports to
3. Key day-to-day responsibilities (2–3 bullets)
4. Must-have qualifications or experience
5. Required technical skills or tools
6. Nice-to-have or preferred skills
7. What the company offers (culture, benefits, team)

Return only the bullet points, each on its own line starting with "•". No intro, no headers, no trailing text.`,
        },
        { role: "user", content: description.slice(0, 5000) },
      ],
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}

/**
 * Scores a job against the candidate's profile using gpt-4o, returning a
 * 0–100 match score, a plain-English reason, matched skills, and missing skills.
 * Location rules are derived from `searchedLocation`; when empty the candidate's
 * profile preferences are used instead. Returns `null` on parse/API failure.
 * @param searchedLocation The explicit location the user searched for (pass empty string to fall back to profile preferences).
 */
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
  "experienceScore": <integer 0-100>,
  "seniorityScore": <integer 0-100>,
  "matchReason": "<one paragraph explaining the match quality>",
  "matchedSkills": ["<every skill from the candidate's list that appears or is implied in the job description>"],
  "missingSkills": ["<skill the job explicitly requires that the candidate does not have>"]
}

experienceScore: How well the candidate's years of experience and work history matches what the role requires. 100 = perfect fit, 0 = far too junior or overqualified.
seniorityScore: How well the candidate's seniority level (junior/mid/senior/lead) matches the role's expected level. 100 = exact match, 0 = major mismatch.

Language note: Job descriptions may be written in any language — Danish, Swedish, Norwegian, German, or others. Technical skill names (TypeScript, Vue.js, React, Nuxt, Node.js, Python, etc.) appear in English even inside non-English text. Read the full description regardless of language and match skills by their English name.

Spoken language matching rules:
- If the job description explicitly requires or strongly prefers a spoken/written language (e.g. "fluent Danish required", "German is a must", "Swedish language skills are a prerequisite"), check the candidate's spoken languages.
- Native is equivalent to Fluent — a candidate with Native proficiency fully satisfies any "fluent" or "proficient" language requirement.
- If the candidate has the required language at any level (Native, Fluent, Advanced, Intermediate, or Basic), include it in matchedSkills (e.g. "Danish"). Only flag it as missing if the candidate has no entry for that language at all.
- If the candidate does NOT have the required language, include it in missingSkills and reduce matchScore significantly (by 20–40 points depending on how critical it appears).
- A language listed only in a "nice to have" or "plus" context should reduce the score by at most 5 points if missing.
- Do NOT penalise for language requirements that are clearly satisfied by English when the candidate speaks English.

Skill matching rules:
- matchedSkills must include EVERY skill from the candidate's profile that is explicitly named in the job description, or is a direct alias/variant of an explicitly named technology (e.g. "Tailwind" matches "Tailwind CSS"; "React Hooks" matches if "React" is named; "Node" matches "Node.js"; "Vue" matches "Vue 3"). Be exhaustive — do not skip skills that genuinely match.
- A direct alias means a more specific or shortened form of the SAME technology. Word similarity alone is NOT a match: "graphing platform" does not match "GraphQL", "scripting" does not match "TypeScript". The technology name itself must appear.
- Do NOT include a skill just because it is commonly associated with a mentioned technology. If the job says "Azure" but not "Docker", do not add "Docker".
- Do NOT include ubiquitous collaboration tools (Jira, Confluence, Figma, GitHub, GitLab, Slack, Notion, Linear, etc.) unless the job description explicitly names them. These tools are used everywhere — their absence from the posting means the job did not list them as a requirement or skill.
- missingSkills should only include skills the job lists as candidate requirements or qualifications (e.g. in sections like "What You Will Bring", "Requirements", "You Need"). Do NOT add skills that only appear in a "Tech Stack", "Our Tools", or "About Us" section — those describe what the company uses, not what the candidate must know.
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
Skills: ${profile.skills?.join(", ") ?? "Not specified"}
Spoken languages: ${profile.spoken_languages?.length ? profile.spoken_languages.map((l) => `${l.language} (${l.level})`).join(", ") : "Not specified"}${(() => {
              const sy = computeSkillYears(profile.work_experience, profile.personal_projects as PersonalProject[] | null);
              const entries = Object.entries(sy).sort((a, b) => b[1] - a[1]);
              return entries.length > 0
                ? `\nSkill experience (years): ${entries.map(([s, y]) => `${s} ${y}yr`).join(", ")}`
                : "";
            })()}
Recent work: ${JSON.stringify(
            profile.work_experience
              ?.slice(0, 2)
              .map((w) => ({ title: w.title, company: w.company })) ?? [],
          )}${(() => {
              const projects = (profile.personal_projects as PersonalProject[] | null) ?? [];
              if (!projects.length) return "";
              return `\nPersonal projects: ${projects.map((p) => `${p.name}${p.skills.length ? ` (${p.skills.join(", ")})` : ""}`).join("; ")}`;
            })()}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) return null;

    const scored = JSON.parse(raw) as ScoredJob;
    return { ...scored, job };
  } catch (err) {
    Sentry.captureException(err, { extra: { jobId: job.id, jobTitle: job.title, company: job.company } });
    console.error(`[agent/find-jobs] scoring failed for job ${job.id}`);
    return null;
  }
}

/**
 * Main job-search orchestrator. Queries the appropriate job boards for the given
 * title and location, deduplicates against the user's existing saved jobs, enriches
 * descriptions (HTTP then browser fallback), scores each job against the user's profile,
 * and persists qualifying matches to the database.
 * @param minScore Minimum match score (0–100) required to save a job. Defaults to `MATCH_THRESHOLD`.
 */
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

    // Fallback: for aggregator jobs still blocked by Cloudflare after HTTP enrichment,
    // use a real browser session (Browserbase) to render the page and get the full text.
    const browserEnriched = await browserEnrichJobs(enrichedJobs);
    if (browserEnriched.size > 0) {
      for (const job of enrichedJobs) {
        const text = browserEnriched.get(job.id);
        if (text) job.description = text;
      }
    }

    // Fill missing salary from description text before scoring
    for (const job of enrichedJobs) {
      if (!job.salary && job.description) {
        const extracted = extractSalaryFromText(job.description);
        if (extracted) job.salary = extracted;
      }
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const scoringResults = await Promise.all(
      enrichedJobs.map((job) => scoreJob(job, profile, openai, location)),
    );

    const qualifyingJobs = scoringResults.filter(
      (r): r is ScoringResult => r !== null && r.matchScore >= minScore,
    );

    // Only skip jobs with no URL at all — all other links (including aggregator/tracking
    // links like jobviewtrack.com) are kept. enrichJobDescription already tries to resolve
    // them to the employer URL; if that fails, the aggregator link itself still works.
    const jobsWithUrl = qualifyingJobs.filter((r) => !!r.job.url);

    const skipped = qualifyingJobs.filter((r) => !r.job.url);

    if (skipped.length > 0) {
      await insforge.database.from("skipped_jobs").insert(
        skipped.map((r) => ({
          user_id: userId,
          run_id: runId,
          title: r.job.title,
          company: r.job.company,
          location: r.job.location,
          url: r.job.url || null,
          source: r.job.source,
          reason: "empty_url",
          match_score: r.matchScore,
        })),
      );
    }

    if (jobsWithUrl.length > 0) {
      // Generate short summaries in parallel — gpt-4o-mini, fast and cheap
      const summaries = await Promise.all(
        jobsWithUrl.map((r) => summarizeDescription(r.job.description, openai)),
      );

      const jobRecords = jobsWithUrl.map((r, i) => ({
        user_id: userId,
        run_id: runId,
        source: "search",
        source_url: r.job.url,
        external_apply_url: r.job.url,
        title: r.job.title,
        company: r.job.company,
        location: normalizeLocationToEnglish(r.job.location),
        salary: r.job.salary ?? null,
        job_type: r.job.job_type ?? "fulltime",
        about_role: r.job.description,
        description_summary: summaries[i] ?? null,
        match_score: r.matchScore,
        experience_score: r.experienceScore ?? null,
        seniority_score: r.seniorityScore ?? null,
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

      jobsWithUrl.forEach((r) => {
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
      .update({ status: "complete", jobs_found: jobsWithUrl.length })
      .eq("id", runId)
      .eq("user_id", userId);

    await posthog.shutdown();

    return {
      success: true,
      jobsFound: allJobs.length,
      jobsSaved: jobsWithUrl.length,
      jobsSkipped: qualifyingJobs.length - jobsWithUrl.length,
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
