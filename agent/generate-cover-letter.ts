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

    // Use structured JSON generation to bypass GPT-4o's strong "cover letter" priors.
    // Free-form generation reliably produces banned enthusiasm language regardless of instructions.
    // Filling discrete JSON fields forces deliberate, constrained output per section.
    const FORBIDDEN = `"passion", "excited", "excites", "resonates", "inspires", "thrive", "seamlessly", "empowering", "leverage", "transformative", "aligns perfectly", "real value", "deliver value", "appreciate the intricacies", "unique combination", "In my professional journey"`;

    const systemPrompt = `You are a JSON generator. Return a JSON object with exactly these 5 keys. Write in ${language}.

{
  "greeting": "${language === "Danish" ? "Hej [Company name]," : "Hi [Company name],"}",
  "intro": "1-2 sentences. State who the candidate is professionally and name at least 2 specific technologies they actually use (e.g. TypeScript, React, Rust, Next.js, Vue 3). Do NOT open with 'I'. Do NOT express enthusiasm.",
  "achievement": "1-2 sentences. Name one specific project or work achievement from the profile. Include what was built and what technology was used. Factual only.",
  "fit": "1-2 sentences. Connect one specific skill or experience from the profile to a concrete requirement from the job. Do not invent connections not supported by the data.",
  "closing": "${language === "Danish" ? "Med venlig hilsen," : "Best regards,"}"
}

HARD RULES — every field must pass these checks:
- No banned words/concepts: ${FORBIDDEN}
- No emotional language of any kind. No statements about what the candidate feels, loves, wants, or is passionate about.
- Only facts that appear in the profile data. TypeScript IS JavaScript — never claim the candidate lacks JS experience.
- Do NOT fabricate connections between unrelated domains (e.g. audio engineering ≠ physical machinery).`;

    const candidateData = `JOB:
Title: ${job.title}
Company: ${job.company}
Full job post: ${fullPost || "Not provided"}${(job.requirements as string[] | null)?.length ? `\nRequirements:\n${(job.requirements as string[]).map((r) => `- ${r}`).join("\n")}` : ""}${(job.responsibilities as string[] | null)?.length ? `\nResponsibilities:\n${(job.responsibilities as string[]).map((r) => `- ${r}`).join("\n")}` : ""}
Matched skills: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
${companyContext}

CANDIDATE:
Name: ${profile.full_name ?? "Not provided"}
Current title: ${profile.current_title ?? "Not provided"}
Experience: ${profile.years_experience ?? 0} years
Skills: ${(profile.skills as string[] | null)?.join(", ") ?? "Not provided"}${skillYearsStr ? `\nSkill experience (years): ${skillYearsStr}` : ""}
Work history (newest first):
${recentWork || "Not provided"}${projectsText ? `\n\nPersonal projects:\n${projectsText}` : ""}${(profile.career_vision as string | null) ? `\n\nCareer direction (context only, do not quote): ${profile.career_vision}` : ""}${(profile.linkedin_url as string | null) ? `\n\nLinkedIn: ${profile.linkedin_url}` : ""}${(profile.portfolio_url as string | null) ? `\nPortfolio: ${profile.portfolio_url}` : ""}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(coverLetterExamples.length > 0 ? [{
        role: "user" as const,
        content: `Voice reference — mirror the sentence rhythm and directness of these examples. Do not copy content:\n\n${coverLetterExamples.map((ex, i) => `--- Example ${i + 1} ---\n${ex.trim()}`).join("\n\n")}`,
      }] : []),
      { role: "user", content: candidateData },
      ...(extraInstructions?.trim() ? [{
        role: "user" as const,
        content: `Additional instructions for this letter: ${extraInstructions.trim()}`,
      }] : []),
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: style === "detailed" ? 900 : 500,
      messages,
    });

    const rawJson = response.choices[0]?.message?.content?.trim();
    if (!rawJson) {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

    let parsed: { greeting?: string; intro?: string; achievement?: string; fit?: string; closing?: string };
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

    const sections = [
      parsed.greeting,
      parsed.intro,
      parsed.achievement,
      parsed.fit,
      parsed.closing,
      profile.full_name ?? "",
    ].filter(Boolean);

    const raw = sections.join("\n\n");
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
