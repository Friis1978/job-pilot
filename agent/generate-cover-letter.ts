import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { computeSkillYears } from "@/lib/utils";
import { detectLanguage } from "@/lib/detect-language";
import type { WorkExperience } from "@/types";

const LANGUAGE_NAMES: Record<string, string> = {
  da: "Danish",
  sv: "Swedish",
  no: "Norwegian",
  de: "German",
  nl: "Dutch",
  fr: "French",
  es: "Spanish",
  en: "English",
};

type Result = { success: boolean; error?: string };

const OPENING_STRATEGIES = [
  "Lead with a specific result or achievement from the candidate's past that directly maps to what this role needs. Make the first sentence about impact, not excitement.",
  "Open with a concrete observation about the company — something specific from the research (a product, a market position, a challenge they face) — then connect it to why the candidate's background is relevant.",
  "Start by naming the exact problem or challenge this role is meant to solve, then immediately show how the candidate has already solved something similar.",
  "Begin in the middle of a story: a specific project, moment, or technical decision the candidate made that is directly relevant to this company's work. No preamble.",
  "Open with a direct statement of fit: what the candidate brings + what the role needs, stated plainly and confidently. No flattery, no 'thrilled to apply'.",
];

export async function generateCoverLetter(
  userId: string,
  jobId: string,
): Promise<Result> {
  const insforge = await createInsforgeServer();
  const posthog = getPostHogClient();

  const [jobRes, profileRes] = await Promise.all([
    insforge.database
      .from("jobs")
      .select(
        "title, company, about_role, responsibilities, requirements, match_reason, matched_skills, missing_skills, company_research",
      )
      .eq("id", jobId)
      .eq("user_id", userId)
      .single(),
    insforge.database
      .from("profiles")
      .select(
        "full_name, current_title, years_experience, skills, work_experience, cover_letter_tone",
      )
      .eq("id", userId)
      .single(),
  ]);

  if (jobRes.error || !jobRes.data) {
    await posthog.shutdown();
    return { success: false, error: "Job not found." };
  }

  if (profileRes.error || !profileRes.data) {
    await posthog.shutdown();
    return { success: false, error: "Profile not found. Please complete your profile first." };
  }

  const job = jobRes.data;
  const profile = profileRes.data;

  const tone = (profile.cover_letter_tone as string | null) ?? "Professional";
  const allJobText = [
    job.title ?? "",
    job.about_role ?? "",
    ...(job.responsibilities as string[] | null ?? []),
    ...(job.requirements as string[] | null ?? []),
  ].join(" ");
  const langCode = detectLanguage(allJobText);
  const language = LANGUAGE_NAMES[langCode] ?? "English";
  const workExp = (profile.work_experience as WorkExperience[] | null) ?? [];
  const recentWork = workExp
    .slice(0, 2)
    .map((w) => `${w.title} at ${w.company}${w.responsibilities ? ": " + w.responsibilities : ""}`)
    .join("\n");

  const skillYears = computeSkillYears(workExp);
  const skillYearsStr = Object.entries(skillYears)
    .sort((a, b) => b[1] - a[1])
    .map(([s, y]) => `${s} ${y}yr`)
    .join(", ");

  const companyContext = job.company_research
    ? `COMPANY RESEARCH:\n${JSON.stringify(job.company_research, null, 2)}`
    : "";

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const openingStrategy = OPENING_STRATEGIES[Math.floor(Math.random() * OPENING_STRATEGIES.length)];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.9,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: `You are an expert cover letter writer. Write a compelling, personalised cover letter in a ${tone} tone.

Opening strategy for THIS letter: ${openingStrategy}

Rules:
- Write the entire letter in ${language} — the job description is in ${language}, so the letter must be too
- NEVER start with "I" as the first word
- NEVER use: "excited", "thrilled", "passion", "couldn't help", "perfect opportunity", "dream role", "long-time admirer", "ideal candidate", or any variant of these
- Do NOT open with enthusiasm about the company — lead with substance, not flattery
- Address it to the hiring team at the company (no "Dear Sir/Madam", no "To Whom It May Concern")
- Every claim must be grounded in the candidate's actual experience — no vague assertions
- Connect specific past work to what this role actually requires
- If company research is provided, reference one concrete specific detail (not generic praise)
- Acknowledge skill gaps honestly and briefly — one sentence max, frame as adjacent strength or quick ramp
- Close with a direct, confident call to action — not "I hope to hear from you"
- 3–4 paragraphs, no longer
- Do NOT include subject line, date, address block, or signature — just the letter body
- Write in first person as the candidate`,
        },
        {
          role: "user",
          content: `JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.about_role ?? "Not provided"}
Matched skills: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
Gap skills: ${(job.missing_skills as string[] | null)?.join(", ") ?? "None"}
${companyContext}

CANDIDATE:
Name: ${profile.full_name ?? "Not provided"}
Current title: ${profile.current_title ?? "Not provided"}
Experience: ${profile.years_experience ?? 0} years
Skills: ${(profile.skills as string[] | null)?.join(", ") ?? "Not provided"}${skillYearsStr ? `\nSkill experience (years): ${skillYearsStr}` : ""}
Recent work:
${recentWork || "Not provided"}`,
        },
      ],
    });

    const coverLetter = response.choices[0]?.message?.content?.trim();
    if (!coverLetter) {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

    const { error: updateError } = await insforge.database
      .from("jobs")
      .update({ cover_letter: coverLetter })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      await posthog.shutdown();
      return { success: false, error: "Failed to save cover letter." };
    }

    posthog.capture({
      distinctId: userId,
      event: "cover_letter_generated",
      properties: { userId, jobId, company: job.company },
    });
    await posthog.shutdown();

    return { success: true };
  } catch (err) {
    console.error("[agent/generate-cover-letter]", err);
    await posthog.shutdown();
    return { success: false, error: "Generation failed. Please try again." };
  }
}
