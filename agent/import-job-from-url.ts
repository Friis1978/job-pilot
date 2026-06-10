import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { stripHtml } from "@/lib/utils";
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

  // Dedup check
  const { data: existing } = await insforge.database
    .from("jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("source_url", url)
    .limit(1);

  if (existing && existing.length > 0) {
    await posthog.shutdown();
    return { success: false, error: "This job is already in your list." };
  }

  // Fetch the page
  let rawText: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const html = await res.text();
    rawText = stripHtml(html).replace(/\s+/g, " ").trim();
  } catch {
    await posthog.shutdown();
    return { success: false, error: "Could not reach this page. Please check the URL and try again." };
  }

  if (rawText.length < 200) {
    await posthog.shutdown();
    return {
      success: false,
      error: "Could not read this page. The site may block automated access (e.g. LinkedIn requires login).",
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    await posthog.shutdown();
    return { success: false, error: "AI extraction is not configured." };
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // GPT-4o extraction
  let extracted: ExtractedJob;
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content: `You are a job posting parser. Extract structured data from raw job posting text.
Return ONLY valid JSON with this exact shape:
{
  "title": "<job title>",
  "company": "<company name>",
  "location": "<location or 'Remote'>",
  "description": "<full job description, up to 1000 chars>",
  "salary": "<salary range or null>",
  "job_type": "<fulltime|parttime|contract|temporary or null>"
}
If title or company cannot be determined, return them as empty strings.`,
        },
        {
          role: "user",
          content: `Extract the job details from this page text (first 4000 chars):\n\n${rawText.slice(0, 4000)}`,
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

  // Build NormalizedJob for scoring
  const job: NormalizedJob = {
    id: crypto.randomUUID(),
    title: extracted.title.trim(),
    company: extracted.company.trim(),
    location: extracted.location?.trim() || "Not specified",
    description: extracted.description?.trim() || "",
    url,
    salary: extracted.salary ?? null,
    job_type: extracted.job_type ?? null,
    source: "url",
  };

  // Score against profile — no location constraint for manual imports
  const scored = await scoreJob(job, profile, openai, "");
  if (!scored) {
    await posthog.shutdown();
    return { success: false, error: "Scoring failed. Please try again." };
  }

  // Save to DB
  const { error: insertError } = await insforge.database.from("jobs").insert([
    {
      user_id: userId,
      source: "url",
      source_url: url,
      external_apply_url: url,
      title: job.title,
      company: job.company,
      location: job.location,
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
  await posthog.shutdown();

  return { success: true };
}
