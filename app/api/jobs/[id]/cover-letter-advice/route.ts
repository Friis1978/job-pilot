import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/ai/claude";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage, LANGUAGE_LABELS, LANGUAGE_NAMES } from "@/lib/detect-language";
import type { WorkExperience, PersonalProject } from "@/types";
import { trackTokens } from "@/lib/track-tokens";
import { keyGuard } from "@/lib/ai/key-guard";

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

    const keyBlocked = await keyGuard(userId);
    if (keyBlocked) return keyBlocked;

    const [jobRes, profileRes] = await Promise.all([
      insforge.database
        .from("jobs")
        .select("title, company, about_role, responsibilities, requirements, match_reason, matched_skills, missing_skills, company_research")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single(),
      insforge.database
        .from("profiles")
        .select("full_name, current_title, years_experience, skills, work_experience, personal_projects, motivation, proud_achievement, energy_tasks, career_vision, cover_letter_tone")
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

    const companyContext = job.company_research
      ? `\nCOMPANY RESEARCH:\n${JSON.stringify(job.company_research, null, 2)}`
      : "";

    const response = await complete({
      userId,
      maxTokens: 600,
      effort: "medium",
      system: `You are a cover letter coach. Your job is NOT to write the cover letter — it is to give the candidate a concise, specific writing brief so they can write it themselves.

Analyse the job and candidate, then return a short brief with exactly these four sections, written in ${language}:

**What to lead with**
One specific opening angle — a concrete achievement, a direct skill match, or a company observation — that will make a strong first impression for THIS role. Be specific, not generic.

**Key points to hit**
3–5 bullet points. Each one should name a specific skill, experience, or project the candidate has that directly maps to what the job needs. Include relevant project names and link them to job requirements.

**Handle the gaps**
One or two sentences only. If there are gap skills, give one honest, specific way to frame the candidate's adjacent strength. If there are no meaningful gaps, write "No significant gaps — lead with confidence."

**Tone & company angle**
One short paragraph. Based on the company research (if available), recommend the right tone (formal/direct/enthusiastic) and one specific cultural or strategic angle the candidate can use to show genuine understanding of what this company cares about.

Keep each section tight. No fluff. Write in ${language}.`,
      user: `JOB:
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
    });

    const advice = response.text;
    trackTokens(userId, "cover_letter_advice", response.model, response.usage.input_tokens, response.usage.output_tokens);
    if (!advice) {
      return NextResponse.json({ error: "Failed to generate advice. Please try again." }, { status: 500 });
    }

    const { error: updateError } = await insforge.database
      .from("jobs")
      .update({ cover_letter_advice: advice })
      .eq("id", jobId)
      .eq("user_id", userId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to save advice." }, { status: 500 });
    }

    return NextResponse.json({ advice, language, labels });
  } catch (err) {
    console.error("[api/jobs/cover-letter-advice POST]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Something went wrong. Please try again.", detail: message }, { status: 500 });
  }
}
