import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { computeSkillYears } from "@/lib/utils";
import { detectLanguage } from "@/lib/detect-language";
import { humanizeText } from "@/agent/humanize-text";
import type { WorkExperience, PersonalProject } from "@/types";

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

type Result = { success: boolean; text?: string; error?: string };


/**
 * Generates a personalised cover letter for a saved job using gpt-4o.
 * Detects the job's language from the posting text and writes the letter in that
 * language. Picks a random opening strategy unless the candidate has provided
 * custom cover letter instructions (which override the default style guide).
 * Archives any existing cover letter to `cover_letter_history` before overwriting.
 * @param extraInstructions Per-generation instructions that override the system prompt when provided.
 */
export async function generateCoverLetter(
  userId: string,
  jobId: string,
  extraInstructions?: string,
  _maxLines?: number,
  style: "compact" | "detailed" = "compact",
): Promise<Result> {
  const insforge = await createInsforgeServer();
  const posthog = getPostHogClient();

  const [jobRes, profileRes] = await Promise.all([
    insforge.database
      .from("jobs")
      .select(
        "title, company, about_role, full_post_text, responsibilities, requirements, match_reason, matched_skills, missing_skills, company_research",
      )
      .eq("id", jobId)
      .eq("user_id", userId)
      .single(),
    insforge.database
      .from("profiles")
      .select(
        "full_name, current_title, years_experience, skills, work_experience, personal_projects, cover_letter_instructions, cover_letter_examples, motivation, proud_achievement, energy_tasks, career_vision, linkedin_url, portfolio_url",
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

  const customInstructions = (profile.cover_letter_instructions as string | null) ?? null;
  const coverLetterExamples = ((profile.cover_letter_examples as string[] | null) ?? []).filter(Boolean).slice(0, 3);
  const fullPost = (job.full_post_text as string | null) || job.about_role || "";
  const allJobText = [
    job.title ?? "",
    fullPost,
    ...(job.responsibilities as string[] | null ?? []),
    ...(job.requirements as string[] | null ?? []),
  ].join(" ");
  const langCode = detectLanguage(allJobText);
  const language = LANGUAGE_NAMES[langCode] ?? "English";
  const workExp = ((profile.work_experience as WorkExperience[] | null) ?? [])
    .slice()
    .sort((a, b) => {
      if (a.currentlyWorking) return -1;
      if (b.currentlyWorking) return 1;
      return (b.endDate ?? b.startDate ?? "").localeCompare(a.endDate ?? a.startDate ?? "");
    });
  const recentWork = workExp
    .map((w, idx) => {
      const label = w.currentlyWorking ? "[CURRENT ROLE]" : idx === 0 ? "[MOST RECENT]" : "";
      const base = `${label ? label + " " : ""}${w.title} at ${w.company} (${w.startDate ?? "?"} – ${w.currentlyWorking ? "present" : (w.endDate ?? "?")})`;
      return w.responsibilities ? `${base}: ${w.responsibilities}` : base;
    })
    .join("\n\n");

  const personalProjects = (profile.personal_projects as PersonalProject[] | null) ?? [];
  const skillYears = computeSkillYears(workExp, personalProjects);
  const skillYearsStr = Object.entries(skillYears)
    .sort((a, b) => b[1] - a[1])
    .map(([s, y]) => `${s} ${y}yr`)
    .join(", ");

  const projectsText = personalProjects.length > 0
    ? personalProjects
        .map((p) => {
          const dateRange = p.startDate ? [p.startDate, p.currentlyWorking ? "present" : p.endDate].filter(Boolean).join("–") : null;
          const parts = [`${p.name}${dateRange ? ` (${dateRange})` : ""}: ${p.description}`];
          if (p.skills.length > 0) parts.push(`Skills: ${p.skills.join(", ")}`);
          if (p.url) parts.push(`Live: ${p.url}`);
          if (p.githubUrl) parts.push(`GitHub: ${p.githubUrl}`);
          if (p.videoUrl) parts.push(`Video: ${p.videoUrl}`);
          return parts.join(" — ");
        })
        .join("\n")
    : "";

  const companyContext = job.company_research
    ? `COMPANY RESEARCH:\n${JSON.stringify(job.company_research, null, 2)}`
    : "";

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = customInstructions
      ? customInstructions
      : `You are writing a cover letter for ${profile.full_name ?? "the candidate"} in ${language}.
Write in first person. Be direct and specific — every claim must be grounded in the candidate's actual profile data. Do not fabricate achievements, team sizes, or responsibilities. Do not express excitement or enthusiasm about the opportunity. Do not mention personal hobbies. End with the candidate's name.`;

    const CRITICAL_REMINDER = `CRITICAL RULES — check every sentence before writing it:
- TypeScript IS JavaScript. Never write that the candidate lacks JavaScript experience. TypeScript is a superset of JavaScript; every TypeScript developer writes JavaScript.
- No fabrication: every claim must appear verbatim in the profile data above. If it is not there, omit it.
- Forbidden phrases (never use): "In my professional journey", "aligns seamlessly", "passion for", "thrilled", "excited", "leverage", "synergize", "dynamic", "impactful", "unique combination of", "not just X but Y"
- No suck-up opener: do not open by naming frameworks or the job title
- Write in ${language} — the language detected from the job posting
Now write the letter.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.6,
      max_tokens: style === "detailed" ? 1200 : 500,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        ...(coverLetterExamples.length > 0 ? [{
          role: "user" as const,
          content: `Here are ${coverLetterExamples.length} example cover letter${coverLetterExamples.length > 1 ? "s" : ""} written by this candidate. Study their voice, sentence structure, tone, and rhythm. Mirror this style in the new letter — do not copy content, only the writing style.\n\n${coverLetterExamples.map((ex, i) => `--- Example ${i + 1} ---\n${ex.trim()}`).join("\n\n")}`,
        }] : []),
        {
          role: "user",
          content: `JOB:
Title: ${job.title}
Company: ${job.company}
Full job post: ${fullPost || "Not provided"}${(job.requirements as string[] | null)?.length ? `\nRequirements:\n${(job.requirements as string[]).map((r) => `- ${r}`).join("\n")}` : ""}${(job.responsibilities as string[] | null)?.length ? `\nResponsibilities:\n${(job.responsibilities as string[]).map((r) => `- ${r}`).join("\n")}` : ""}
Matched skills: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
Gap skills: ${(job.missing_skills as string[] | null)?.join(", ") ?? "None"}${(job.match_reason as string | null) ? `\nWhy this job fits the candidate: ${job.match_reason}` : ""}
${companyContext}

CANDIDATE:
Name: ${profile.full_name ?? "Not provided"}
Current title: ${profile.current_title ?? "Not provided"}
Experience: ${profile.years_experience ?? 0} years
All skills: ${(profile.skills as string[] | null)?.join(", ") ?? "Not provided"}${skillYearsStr ? `\nSkill experience (years): ${skillYearsStr}` : ""}
Full work history (sorted newest first — [CURRENT ROLE] or [MOST RECENT] marks the top entry):
${recentWork || "Not provided"}${projectsText ? `\n\nPersonal projects:\n${projectsText}` : ""}

WHAT DRIVES THIS CANDIDATE (use only what maps to professional work in this role — never mention hobbies or personal interests):${(profile.motivation as string | null) ? `\nMotivation: ${profile.motivation}` : ""}${(profile.proud_achievement as string | null) ? `\nKey achievement: ${profile.proud_achievement}` : ""}${(profile.energy_tasks as string | null) ? `\nWhat energises them professionally: ${profile.energy_tasks}` : ""}${(profile.career_vision as string | null) ? `\nCareer vision: ${profile.career_vision}` : ""}${(profile.linkedin_url as string | null) ? `\n\nLinkedIn: ${profile.linkedin_url}` : ""}${(profile.portfolio_url as string | null) ? `\nPortfolio: ${profile.portfolio_url}` : ""}`,
        },
        ...(extraInstructions?.trim() ? [{
          role: "user" as const,
          content: `IMPORTANT — extra instructions for this specific letter (override anything above if they conflict):\n${extraInstructions.trim()}`,
        }] : []),
        {
          role: "user" as const,
          content: CRITICAL_REMINDER,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

    const coverLetter = customInstructions ? raw : await humanizeText(raw, openai);

    // Archive existing cover letter before overwriting
    const { data: existingJob } = await insforge.database
      .from("jobs")
      .select("cover_letter")
      .eq("id", jobId)
      .eq("user_id", userId)
      .single();
    if (existingJob?.cover_letter) {
      await insforge.database
        .from("cover_letter_history")
        .insert([{ job_id: jobId, user_id: userId, text: existingJob.cover_letter, source: "generated" }]);
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

    return { success: true, text: coverLetter };
  } catch (err) {
    console.error("[agent/generate-cover-letter]", err);
    await posthog.shutdown();
    return { success: false, error: "Generation failed. Please try again." };
  }
}
