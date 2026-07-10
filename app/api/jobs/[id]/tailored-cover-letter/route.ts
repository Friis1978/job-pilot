import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage, LANGUAGE_LABELS } from "@/lib/detect-language";
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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = authData.user.id;

    const [jobRes, profileRes] = await Promise.all([
      insforge.database
        .from("jobs")
        .select("title, company, about_role, responsibilities, requirements, match_reason, matched_skills, missing_skills, company_research")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single(),
      insforge.database
        .from("profiles")
        .select("full_name, current_title, years_experience, skills, work_experience, personal_projects, motivation, proud_achievement, energy_tasks, career_vision, cover_letter_tone, cover_letter_instructions, cover_letter_examples")
        .eq("id", userId)
        .single(),
    ]);

    if (jobRes.error || !jobRes.data) {
      return NextResponse.json({ error: "Job not found." }, { status: 404 });
    }
    if (profileRes.error || !profileRes.data) {
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    const job = jobRes.data;
    const profile = profileRes.data;

    const allJobText = [
      job.title ?? "",
      job.about_role ?? "",
      ...((job.responsibilities as string[] | null) ?? []),
      ...((job.requirements as string[] | null) ?? []),
    ].join(" ");
    const langCode = detectLanguage(allJobText);
    const language = LANGUAGE_NAMES[langCode] ?? "English";
    const labels = LANGUAGE_LABELS[langCode] ?? LANGUAGE_LABELS.en;

    const workExp = (profile.work_experience as WorkExperience[] | null) ?? [];
    const personalProjects = (profile.personal_projects as PersonalProject[] | null) ?? [];

    const toneInstruction = profile.cover_letter_tone
      ? `Use a ${profile.cover_letter_tone} tone.`
      : "Use a confident and professional tone.";

    const coverLetterExamples = ((profile.cover_letter_examples as string[] | null) ?? []).filter(Boolean).slice(0, 3);
    const customInstructions = (profile.cover_letter_instructions as string | null) ?? null;

    const companyContext = job.company_research
      ? `\nCOMPANY RESEARCH:\n${JSON.stringify(job.company_research, null, 2)}`
      : "";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.5,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `You are an expert cover letter writer. Write a tailored, compelling cover letter in ${language}.

Rules:
- Maximum 20 lines (including blank lines)
- No subject line, no date, no address header — start directly with the opening paragraph
- Do NOT include placeholders like [Your Name] or [Date]
- End with just the candidate's name as the sign-off
- ${toneInstruction}${customInstructions ? `\n- Candidate's personal style guide: ${customInstructions}` : ""}
- Be specific: reference the company name, role title, and concrete skills/experiences
- Show genuine understanding of what the company needs
- Never be generic — every sentence must be tailored to this specific job
- NEVER start with "I" as the first word
- NEVER use: "excited", "thrilled", "passion", "perfect opportunity", "dream role", or any variant
- CRITICAL: Never invent, fabricate, or assume details not explicitly provided. Do not make up company names, project names, team sizes, metrics, platforms, achievements, or anything else not present in the candidate data. If a detail is not in the candidate data, do not use it`,
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
Description: ${job.about_role ?? "Not provided"}${(job.requirements as string[] | null)?.length ? `\nRequirements:\n${(job.requirements as string[]).map((r) => `- ${r}`).join("\n")}` : ""}
Matched skills: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
Gap skills: ${(job.missing_skills as string[] | null)?.join(", ") ?? "None"}${(job.match_reason as string | null) ? `\nWhy this fits: ${job.match_reason}` : ""}${companyContext}

CANDIDATE:
Name: ${profile.full_name ?? "Not provided"}
Current title: ${profile.current_title ?? "Not provided"}
Experience: ${profile.years_experience ?? 0} years
Skills: ${(profile.skills as string[] | null)?.join(", ") ?? "Not provided"}
Work history: ${workExp.map((w) => `${w.title} at ${w.company}`).join("; ") || "Not provided"}${personalProjects.length > 0 ? `\nPersonal projects: ${personalProjects.map((p) => p.name).join(", ")}` : ""}${(profile.motivation as string | null) ? `\nMotivation: ${profile.motivation}` : ""}${(profile.proud_achievement as string | null) ? `\nKey achievement: ${profile.proud_achievement}` : ""}${(profile.career_vision as string | null) ? `\nCareer vision: ${profile.career_vision}` : ""}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) {
      return NextResponse.json({ error: "Failed to generate cover letter. Please try again." }, { status: 500 });
    }

    const text = await humanizeText(raw, openai);
    return NextResponse.json({ text, language, labels });
  } catch (err) {
    console.error("[api/jobs/tailored-cover-letter POST]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Something went wrong. Please try again.", detail: message }, { status: 500 });
  }
}
