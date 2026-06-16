import OpenAI from "openai";
import { Stagehand } from "@browserbasehq/stagehand";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { stripHtml, normalizeLocationToEnglish } from "@/lib/utils";
import { browserbase } from "@/lib/browserbase";
import { scoreJob } from "@/agent/find-jobs";
import type { Profile, NormalizedJob } from "@/types";

type Result = { success: boolean; error?: string };

type ExtractedJob = {
  title: string;
  company: string;
  location: string;
  description: string;
  salary: string | null;
  job_type: string | null;
};

/**
 * Extract a LinkedIn job ID from any LinkedIn jobs URL:
 * - /jobs/view/1234
 * - /jobs/collections/recommended/?currentJobId=1234
 * - /jobs/search/?currentJobId=1234
 */
function extractLinkedInJobId(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes("linkedin.com")) return null;
    // currentJobId query param (collections, search, etc.)
    const qp = u.searchParams.get("currentJobId");
    if (qp && /^\d+$/.test(qp)) return qp;
    // /jobs/view/{id} path
    const m = u.pathname.match(/\/jobs\/view\/(\d+)/);
    if (m) return m[1];
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract embedded JSON state from SSR HTML pages.
 * Covers Angular (ng-state), Next.js (__NEXT_DATA__), Nuxt (__NUXT_DATA__), etc.
 * Returns the raw JSON string if found, otherwise null.
 * This is the primary way to get job data from SSR frameworks that embed their state
 * in a <script type="application/json"> tag rather than in visible text nodes.
 */
function extractEmbeddedState(html: string): string | null {
  // Ordered by specificity — try named patterns first, then generic json scripts
  const patterns = [
    /<script[^>]*id="ng-state"[^>]*>([\s\S]*?)<\/script>/i,      // Angular
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i, // Next.js
    /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i, // Nuxt
    /<script[^>]*id="initial-state"[^>]*>([\s\S]*?)<\/script>/i, // generic
    // No catch-all: generic application/json scripts are too likely to match
    // cookie-consent or analytics blobs, causing GPT-4o to extract the wrong data.
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m && m[1].trim().length > 100) return m[1].trim();
  }
  return null;
}

/**
 * Render a JS-heavy page with a real browser via Stagehand/Browserbase.
 * Used as a fallback when plain fetch returns an empty SPA shell.
 */
async function fetchWithBrowser(url: string): Promise<string | null> {
  let stagehand: Stagehand | null = null;
  let sessionId: string | null = null;
  try {
    const session = await browserbase.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      timeout: 60,
    });
    sessionId = session.id;
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY!,
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      browserbaseSessionID: sessionId,
      model: { modelName: "gpt-4o", apiKey: process.env.OPENAI_API_KEY! },
      disablePino: true,
    });
    await stagehand.init();
    const page = stagehand.context.activePage()!;
    await page.goto(url, { waitUntil: "networkidle" });
    // Get the fully-rendered text content (JS has already populated the DOM)
    const innerText = await page.evaluate(() => document.body.innerText);
    const text = (typeof innerText === "string" ? innerText : "")
      .replace(/\s+/g, " ").trim();
    return text.length > 200 ? text : null;
  } catch {
    return null;
  } finally {
    if (stagehand) {
      await stagehand.close().catch(() => null);
    } else if (sessionId) {
      // Stagehand never fully initialised — release the Browserbase session directly
      await browserbase.sessions
        .update(sessionId, { status: "REQUEST_RELEASE" })
        .catch(() => null);
    }
  }
}

/**
 * Fetch a LinkedIn job via the public guest API (no auth required).
 * Returns stripped text or null if the endpoint fails.
 */
async function fetchLinkedInJob(jobId: string): Promise<string | null> {
  const guestUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
  try {
    const res = await fetch(guestUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Strip style/script content before tag-stripping so inline CSS/JS doesn't pollute the text
    const cleaned = html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "");
    const text = stripHtml(cleaned).replace(/\s+/g, " ").trim();
    return text.length > 200 ? text : null;
  } catch {
    return null;
  }
}

export async function importJobFromUrl(userId: string, url: string): Promise<Result> {
  const insforge = await createInsforgeServer();
  const posthog = getPostHogClient();

  // Load profile
  const { data: profileData, error: profileError } = await insforge.database
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profileError || !profileData) {
    await posthog.shutdown();
    return { success: false, error: "Profile not found. Please complete your profile first." };
  }

  const profile = profileData as Profile;

  // Normalise LinkedIn SPA URLs to the canonical source_url (view URL)
  const linkedInJobId = extractLinkedInJobId(url);
  const canonicalUrl = linkedInJobId
    ? `https://www.linkedin.com/jobs/view/${linkedInJobId}/`
    : url;

  // Dedup check against canonical URL
  const { data: existing } = await insforge.database
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("source_url", canonicalUrl)
    .limit(1);

  if (existing && existing.length > 0) {
    await posthog.shutdown();
    return { success: false, error: "This job is already in your list." };
  }

  // Fetch the page — LinkedIn needs its guest API; other sites use direct fetch
  let rawText: string;
  try {
    if (linkedInJobId) {
      const text = await fetchLinkedInJob(linkedInJobId);
      if (!text) {
        await posthog.shutdown();
        return {
          success: false,
          error: "Could not load this LinkedIn job — it may have been removed or is no longer public.",
        };
      }
      rawText = text;
    } else {
      let html = "";
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        });
        html = await res.text();
        // Pre-remove <script> and <style> content before stripping tags.
        // Angular/Next.js SSR pages embed large JSON blobs (ng-state, __NEXT_DATA__)
        // inside <script> tags. Without this step, stripHtml leaves the raw JSON text
        // in rawText, which then dominates the first N chars and pushes the actual
        // job description content past the scoring window.
        const cleanedHtml = html
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<script[\s\S]*?<\/script>/gi, "");
        rawText = stripHtml(cleanedHtml).replace(/\s+/g, " ").trim();
        // Bot-check pages (Cloudflare, Careerjet, etc.) return a short challenge
        // that passes the length threshold but contains no job data — clear it so
        // we fall through to browser rendering.
        if (/bekræftelse påkrævet|checking your browser|just a moment|enable javascript|unusual traffic/i.test(rawText)) {
          rawText = "";
        }
      } catch {
        rawText = "";
      }

      // SSR frameworks (Angular, Next.js, Nuxt…) embed their state as JSON in a
      // <script type="application/json"> tag — extract from the original html
      // (before script removal) when the clean text is too short to be useful.
      if (rawText.length < 200 && html.length > 0) {
        const embeddedState = extractEmbeddedState(html);
        if (embeddedState) {
          rawText = embeddedState;
        }
      }

      // Pure client-side SPA with no embedded state — spin up a real browser
      if (rawText.length < 200) {
        console.log("[agent/import-job-from-url] static fetch got empty page, trying browser render…");
        const browserText = await fetchWithBrowser(url);
        if (!browserText) {
          await posthog.shutdown();
          return {
            success: false,
            error: "Could not read this page — it may require login or block automated access.",
          };
        }
        rawText = browserText;
      }
    }
  } catch {
    await posthog.shutdown();
    return { success: false, error: "Could not reach this page. Please check the URL and try again." };
  }

  if (!process.env.OPENAI_API_KEY) {
    await posthog.shutdown();
    return { success: false, error: "AI extraction is not configured." };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Deduplicate the raw text before sending to GPT-4o.
  // SPAs (like Emply) often render content twice — once in SSR HTML and once after
  // hydration — producing large duplicate blocks that waste context window.
  const deduplicatedText = (() => {
    const lines = rawText.split(/\n+/);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const line of lines) {
      const key = line.trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
    return out.join("\n");
  })();

  // GPT-4o extraction
  let extracted: ExtractedJob;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2500,
      messages: [
        {
          role: "system",
          content: `You are a job posting parser. Extract structured data from a job posting.
The input may be plain text, HTML, or a JSON blob from a framework's server-side state (Angular ng-state, Next.js __NEXT_DATA__, etc.) — parse whichever it is.
The posting may be in any language (Danish, Swedish, Norwegian, German, etc.). Extract the description in the ORIGINAL language — do not translate it.
Ignore navigation text (e.g. "Log ind", "Min profil", "Sign in", breadcrumbs, cookie banners) — only extract actual job posting content.
Return ONLY valid JSON with this exact shape:
{
  "title": "<job title>",
  "company": "<company name>",
  "location": "<city and/or country, or 'Remote', or null if not found>",
  "description": "<full job description in the original language, including role summary, responsibilities, requirements and qualifications — up to 3000 chars>",
  "salary": "<salary range or null>",
  "job_type": "<fulltime|parttime|contract|temporary or null>"
}
Location rules:
- Look for city names, country names, office addresses, or phrases like "onsite in X", "based in X", or Danish equivalents
- If only a street address is given, extract the city from it
- If no location can be determined at all, return null
If title or company cannot be determined, return them as empty strings.`,
        },
        {
          role: "user",
          content: `Extract the job details from this content:\n\n${deduplicatedText.slice(0, 10000)}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) throw new Error("Empty response");
    extracted = JSON.parse(raw) as ExtractedJob;
  } catch {
    await posthog.shutdown();
    return { success: false, error: "Could not extract job details from this page. Try a different URL." };
  }

  if (!extracted.title?.trim() || !extracted.company?.trim()) {
    await posthog.shutdown();
    return { success: false, error: "Could not identify the job title or company from this page." };
  }

  // Build NormalizedJob — use extracted description for display/storage.
  // Fall back to deduplicated raw text if GPT-4o returned an empty description
  // (common when the page is in a non-English language and the model skips it).
  const extractedDescription = extracted.description?.trim() || "";
  const fallbackDescription = extractedDescription || deduplicatedText.slice(0, 3000);

  const job: NormalizedJob = {
    id: crypto.randomUUID(),
    title: extracted.title.trim(),
    company: extracted.company.trim(),
    location: extracted.location?.trim() || null,
    description: fallbackDescription,
    url: canonicalUrl,
    salary: extracted.salary ?? null,
    job_type: extracted.job_type ?? null,
    source: "url",
  };

  // Score against profile using the deduplicated text so skills mentioned later
  // in the posting aren't pushed out of context by duplicate content.
  const jobForScoring: NormalizedJob = {
    ...job,
    description: deduplicatedText.slice(0, 8000),
  };
  const scored = await scoreJob(jobForScoring, profile, openai, "");
  if (!scored) {
    await posthog.shutdown();
    return { success: false, error: "Scoring failed. Please try again." };
  }

  // Save to DB
  // Note: no threshold check here — the user explicitly chose to import this job,
  // so we always save it. The score is still computed and visible on the detail page.
  const { error: insertError } = await insforge.database.from("jobs").insert([
    {
      user_id: userId,
      source: "url",
      source_url: canonicalUrl,
      external_apply_url: canonicalUrl,
      title: job.title,
      company: job.company,
      location: normalizeLocationToEnglish(job.location),
      salary: job.salary ?? null,
      job_type: job.job_type ?? "fulltime",
      about_role: job.description,
      match_score: scored.matchScore,
      match_reason: scored.matchReason,
      matched_skills: scored.matchedSkills,
      missing_skills: scored.missingSkills,
      status: "saved",
      found_at: new Date().toISOString(),
    },
  ]);

  if (insertError) {
    console.error("[agent/import-job-from-url] insert error", insertError);
    await posthog.shutdown();
    return { success: false, error: "Failed to save the job. Please try again." };
  }

  posthog.capture({
    distinctId: userId,
    event: "job_imported_from_url",
    properties: { userId, company: job.company, matchScore: scored.matchScore },
  });
  posthog.capture({
    distinctId: userId,
    event: "job_found",
    properties: { userId, source: "url_import", matchScore: scored.matchScore },
  });
  await posthog.shutdown();

  return { success: true };
}
