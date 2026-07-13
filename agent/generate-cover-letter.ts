import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { computeSkillYears } from "@/lib/utils";
import { detectLanguage } from "@/lib/detect-language";
import { humanizeText } from "@/agent/humanize-text";
import type { WorkExperience, PersonalProject } from "@/types";
import { trackTokens } from "@/lib/track-tokens";

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

type SaplingFeedback = { score: number | null; action: string; flaggedSentences: number; sentenceScores: { sentence: string; score: number }[] };
type Result = { success: boolean; text?: string; error?: string; saplingFeedback?: SaplingFeedback };


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

  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: "AI generation is not configured (missing ANTHROPIC_API_KEY)." };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // used only for humanizeText

    // Build system prompt from user's own cover letter instructions (primary source of truth).
    // Fall back to minimal defaults only when no profile instructions exist.
    const defaultInstructions = `Write a professional cover letter in ${language}.
- First person only. Never write the candidate's name in the body. Never use third person.
- Never open a sentence with "I" — vary openings (use the role, a technology, a company name, or a result instead).
- No enthusiasm, no emotional language, no fabrication. Facts only.
- Name at least 2 specific technologies the candidate actually uses, with context.
- Reference at least one real project or past role by name and what was built/achieved.
- No three-part lists ("X, Y, and Z") — break them into separate statements.
- No hedging: "I believe", "I feel", "I think" — remove the hedge entirely.
- Forbidden words (any form or tense): passion, excited, thrilled, leverage, align, dynamic, impactful, seamlessly, empower, transformative, synergize, robust, scalable, furthermore, moreover, additionally.`;

    const writingInstructions = customInstructions?.trim() || defaultInstructions;

    const systemPrompt = `${writingInstructions}

OUTPUT FORMAT — return a JSON object with exactly these 4 keys. Write in ${language}.
{
  "greeting": "${language === "Danish" ? "Hej [Company name]," : "Hi [Company name],"}",
  "intro": "1-2 sentences: what the candidate does professionally, naming 2+ specific technologies they actually use — no generic openers",
  "achievement": "1-2 sentences: one specific project or past-role achievement — name the project/company, the technology used, and the concrete outcome (number, scale, or result if the data supports it — never invent one)",
  "fit": "1 sentence: name a past company or project, a specific technology or decision made, and the result — no future-tense promises, no connector phrases like 'which is why' or 'making me'"
}
Return valid JSON only. No markdown. No code fences. Do NOT include a closing line or the candidate's name in any field — those are added separately.`;

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

    const userMessages: Anthropic.MessageParam[] = [
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

    const MODEL = "claude-sonnet-4-6";
    const response = await anthropic.messages.create({
      model: MODEL,
      system: systemPrompt,
      temperature: 0.7,
      max_tokens: style === "detailed" ? 900 : 500,
      messages: userMessages,
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text.trim() : "";
    // Strip markdown code fences Claude sometimes wraps around JSON
    const rawJson = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    trackTokens(userId, "cover_letter", MODEL, response.usage.input_tokens, response.usage.output_tokens);
    if (!rawJson) {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

    const BANNED_REGEX = /\b(align(?:s|ing|ed)?|match(?:es|ing|ed)? (the|your) (backend|frontend|full.stack|tech|stack|requirement)|additionally|furthermore|moreover|passion(?:ate)?|excited|excites|resonates|inspires|thrives?|seamlessly|empowering|leverage|leverages?|transformative|complemented by|I bring|spans (across|over|both)|showcas(?:ing|ed)?|scalable solutions|scalable platform|scalable architecture|consistently delivered|various platforms|robust (applications?|backend|platform|solution|technical)|(?:strong|solid) foundation|focusing on performance and user experience|enhancing user experience|improving functionality|effective (collaboration|technical solutions)|critical business processes|impactful|dynamic|synergize[sd]?|high-value|continuous improvement|thrilled|appealing|enhanced development processes|technical foundations?|well-covered|tenure|were honed|modern tech stacks?|meets your need|will support your|key components of your|integral to)\b/gi;

    let parsed: { greeting?: string; intro?: string; achievement?: string; fit?: string; closing?: string };
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

    // Auto-retry once if banned words slipped through
    const firstDraft = [parsed.intro, parsed.achievement, parsed.fit].join(" ");
    const violations = [...new Set((firstDraft.match(BANNED_REGEX) ?? []).map(w => w.toLowerCase()))];
    if (violations.length > 0) {
      console.log(`[cover-letter] Banned words detected (${violations.join(", ")}), retrying...`);
      const retryResponse = await anthropic.messages.create({
        model: MODEL,
        system: systemPrompt,
        temperature: 0.5,
        max_tokens: style === "detailed" ? 900 : 500,
        messages: [
          ...userMessages,
          { role: "assistant", content: rawJson },
          { role: "user", content: `BANNED WORDS FOUND: ${violations.join(", ")}. These are absolutely forbidden. Rewrite the JSON replacing every instance with direct, factual phrasing. Do not use them in any form or tense.` },
        ],
      });
      const retryRaw = retryResponse.content[0]?.type === "text" ? retryResponse.content[0].text.trim() : "";
      const retryJson = retryRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      trackTokens(userId, "cover_letter", MODEL, retryResponse.usage.input_tokens, retryResponse.usage.output_tokens);
      if (retryJson) {
        try { parsed = JSON.parse(retryJson); } catch { /* keep original parsed */ }
      }
    }

    // Hardcode closing — never trust the model with it, it always appends the candidate's name
    const closingText = language === "Danish" ? "Med venlig hilsen," : "Best regards,";

    const sections = [
      parsed.greeting,
      parsed.intro,
      parsed.achievement,
      parsed.fit,
      closingText,
      profile.full_name ?? "",
    ].filter(Boolean);

    const raw = sections.join("\n\n");
    const humanizeResult = await humanizeText(raw, openai, userId);
    const coverLetter = humanizeResult.text;
    const saplingFeedback = {
      score: humanizeResult.saplingScore,
      action: humanizeResult.action,
      flaggedSentences: humanizeResult.flaggedSentences,
      sentenceScores: humanizeResult.sentenceScores,
    };

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

    return { success: true, text: coverLetter, saplingFeedback };
  } catch (err) {
    console.error("[agent/generate-cover-letter]", err);
    await posthog.shutdown();
    return { success: false, error: "Generation failed. Please try again." };
  }
}
