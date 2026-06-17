import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { computeSkillYears } from "@/lib/utils";
import { detectLanguage } from "@/lib/detect-language";
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
  extraInstructions?: string,
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
        "full_name, current_title, years_experience, skills, work_experience, personal_projects, cover_letter_tone, cover_letter_instructions, motivation, proud_achievement, energy_tasks, company_type_preference, career_vision",
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
  const customInstructions = (profile.cover_letter_instructions as string | null) ?? null;
  const allJobText = [
    job.title ?? "",
    job.about_role ?? "",
    ...(job.responsibilities as string[] | null ?? []),
    ...(job.requirements as string[] | null ?? []),
  ].join(" ");
  const langCode = detectLanguage(allJobText);
  const language = LANGUAGE_NAMES[langCode] ?? "English";
  const workExp = (profile.work_experience as WorkExperience[] | null) ?? [];
  // Include all work experiences — the AI needs the full history to reference relevant skills
  const recentWork = workExp
    .map((w) => {
      const base = `${w.title} at ${w.company} (${w.startDate ?? "?"} – ${w.currentlyWorking ? "present" : (w.endDate ?? "?")})`;
      // Include full responsibilities for all roles so no relevant experience is lost
      return w.responsibilities ? `${base}: ${w.responsibilities}` : base;
    })
    .join("\n\n");

  const personalProjects = (profile.personal_projects as PersonalProject[] | null) ?? [];
  const skillYears = computeSkillYears(workExp, personalProjects);
  const skillYearsStr = Object.entries(skillYears)
    .sort((a, b) => b[1] - a[1])
    .map(([s, y]) => `${s} ${y}yr`)
    .join(", ");

  const companyTypePreference = (profile.company_type_preference as string[] | null) ?? [];
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

    const openingStrategy = OPENING_STRATEGIES[Math.floor(Math.random() * OPENING_STRATEGIES.length)];


    const coreRules = `
Content rules — apply regardless of any other instructions:
- Use the match reason to understand exactly why this candidate fits this role — build the narrative around it
- Use the company research to show you understand what this company actually does, what challenges they face, and what kind of person would succeed there — then connect that directly to the candidate's background. Do not just name-drop the company; show you understand their world
- Draw on ALL of the candidate's work history — matched skills are a hint, not the limit. Older roles can contain highly relevant experience
- Where the candidate has years of experience for a skill relevant to this role, include the number naturally (e.g. "5 years of React")
- If personal projects are listed, weave in at least one that's relevant — mention it by name and include its live URL or GitHub URL inline ("you can see this at https://...") — real links turn claims into proof
- If motivation, key achievement, energy tasks, or career vision are provided, let them shape the letter — these reveal who the candidate genuinely is, not just what they've done
- Acknowledge gap skills briefly — one sentence max, frame as adjacent strength or fast ramp
- Close with a direct, confident call to action — not "I hope to hear from you"
${companyTypePreference.length > 0 ? `- The candidate prefers ${companyTypePreference.join(" / ")} environments — reflect language and values that resonate with that culture\n` : ""}- 3–4 paragraphs, no longer
- Do NOT include subject line, date, address block, or signature — just the letter body
- Write in first person as the candidate
- Write the entire letter in ${language}`;

    const systemPrompt = customInstructions
      ? `You are an expert cover letter writer. The candidate's instruction set below is their personal style guide — follow it for voice, tone, structure, and formatting preferences.
${coreRules}

CANDIDATE'S COVER LETTER INSTRUCTIONS:
${customInstructions}`
      : `You are an expert cover letter writer. Write a compelling, personalised cover letter in a ${tone} tone.

Opening strategy for THIS letter: ${openingStrategy}

Additional style rules:
- NEVER start with "I" as the first word
- NEVER use: "excited", "thrilled", "passion", "couldn't help", "perfect opportunity", "dream role", "long-time admirer", "ideal candidate", or any variant of these
- Do NOT open with enthusiasm about the company — lead with substance, not flattery
- Address it to the hiring team at the company (no "Dear Sir/Madam", no "To Whom It May Concern")
- Every claim must be grounded in the candidate's actual experience — no vague assertions
${coreRules}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.9,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.about_role ?? "Not provided"}${(job.requirements as string[] | null)?.length ? `\nRequirements:\n${(job.requirements as string[]).map((r) => `- ${r}`).join("\n")}` : ""}${(job.responsibilities as string[] | null)?.length ? `\nResponsibilities:\n${(job.responsibilities as string[]).map((r) => `- ${r}`).join("\n")}` : ""}
Matched skills: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
Gap skills: ${(job.missing_skills as string[] | null)?.join(", ") ?? "None"}${(job.match_reason as string | null) ? `\nWhy this job fits the candidate: ${job.match_reason}` : ""}
${companyContext}

CANDIDATE:
Name: ${profile.full_name ?? "Not provided"}
Current title: ${profile.current_title ?? "Not provided"}
Experience: ${profile.years_experience ?? 0} years
All skills: ${(profile.skills as string[] | null)?.join(", ") ?? "Not provided"}${skillYearsStr ? `\nSkill experience (years): ${skillYearsStr}` : ""}
Full work history:
${recentWork || "Not provided"}${projectsText ? `\n\nPersonal projects:\n${projectsText}` : ""}${(profile.motivation as string | null) ? `\n\nMotivation: ${profile.motivation}` : ""}${(profile.proud_achievement as string | null) ? `\nKey achievement: ${profile.proud_achievement}` : ""}${(profile.energy_tasks as string | null) ? `\nWhat energizes them: ${profile.energy_tasks}` : ""}${(profile.career_vision as string | null) ? `\nCareer vision: ${profile.career_vision}` : ""}`,
        },
        ...(extraInstructions?.trim() ? [{
          role: "user" as const,
          content: `IMPORTANT — extra instructions for this specific letter (override anything above if they conflict):\n${extraInstructions.trim()}\n\nNow write the letter.`,
        }] : []),
      ],
    });

    const coverLetter = response.choices[0]?.message?.content?.trim();
    if (!coverLetter) {
      await posthog.shutdown();
      return { success: false, error: "Generation failed. Please try again." };
    }

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

    return { success: true };
  } catch (err) {
    console.error("[agent/generate-cover-letter]", err);
    await posthog.shutdown();
    return { success: false, error: "Generation failed. Please try again." };
  }
}
