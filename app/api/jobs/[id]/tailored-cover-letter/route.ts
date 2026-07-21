import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage, LANGUAGE_LABELS, LANGUAGE_NAMES } from "@/lib/detect-language";
import type { WorkExperience, PersonalProject } from "@/types";
import { trackTokens } from "@/lib/track-tokens";

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

    const FORBIDDEN = `"passion", "excited", "excites", "resonates", "inspires", "thrive", "seamlessly", "empowering", "leverage", "transformative", "aligns perfectly", "real value", "deliver value", "appreciate the intricacies", "unique combination", "In my professional journey", "perfect opportunity", "dream role", "thrilled"`;

    const greeting = language === "Danish" ? "Hej [Company name]," : "Hi [Company name],";
    const closing = language === "Danish" ? "Med venlig hilsen," : "Best regards,";

    const systemPrompt = `You are a JSON generator. Return a JSON object with exactly these 5 keys. Write in ${language}.

{
  "greeting": "${greeting}",
  "intro": "1-2 sentences. Who the candidate is professionally. Must name at least 2 specific technologies from their actual skills (e.g. TypeScript, React, Rust, Next.js, Vue 3). Do NOT start with 'I'. Do NOT express enthusiasm or emotion.",
  "achievement": "1-2 sentences. One specific project or work achievement by name. State what was built, what technology was used, and what changed as a result. Facts only.",
  "fit": "1-2 sentences. Connect one specific skill or past experience to a concrete requirement from this job posting. Do not invent connections not in the data.",
  "closing": "${closing}"
}

HARD RULES — every field must pass:
- Banned words/concepts (no synonyms either): ${FORBIDDEN}
- No emotional language. No statements about what the candidate feels, wants, loves, or is passionate about.
- Only facts present in the profile data. TypeScript IS JavaScript — never say the candidate lacks JS experience.
- Do NOT fabricate connections between unrelated domains.
- Do NOT repeat the same sentence or phrase across fields.${customInstructions ? `\n\nSTYLE GUIDE (apply voice/structure rules only — do NOT apply enthusiasm or personality expression):\n${customInstructions}` : ""}`;

    const workHistory = workExp
      .map((w: WorkExperience) => {
        const bullets = (w.responsibilities as unknown as string[] | null)?.slice(0, 3).map((r) => `  - ${r}`).join("\n") ?? "";
        return `${w.title} at ${w.company}${bullets ? "\n" + bullets : ""}`;
      })
      .join("\n");

    const candidateData = `JOB:
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
Work history:
${workHistory || "Not provided"}${personalProjects.length > 0 ? `\nPersonal projects: ${personalProjects.map((p: PersonalProject) => `${p.name}${p.description ? ` — ${p.description}` : ""}`).join("; ")}` : ""}`;

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(coverLetterExamples.length > 0 ? [{
        role: "user" as const,
        content: `Voice reference — mirror the sentence rhythm and directness of these examples. Do not copy content:\n\n${coverLetterExamples.map((ex: string, i: number) => `--- Example ${i + 1} ---\n${ex.trim()}`).join("\n\n")}`,
      }] : []),
      { role: "user", content: candidateData },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 600,
      messages,
    });

    const rawJson = response.choices[0]?.message?.content?.trim();
    trackTokens(userId, "tailored_cover_letter", "gpt-4o", response.usage?.prompt_tokens ?? 0, response.usage?.completion_tokens ?? 0);
    if (!rawJson) {
      return NextResponse.json({ error: "Failed to generate cover letter. Please try again." }, { status: 500 });
    }

    let parsed: { greeting?: string; intro?: string; achievement?: string; fit?: string; closing?: string };
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return NextResponse.json({ error: "Failed to generate cover letter. Please try again." }, { status: 500 });
    }

    const text = [
      parsed.greeting,
      parsed.intro,
      parsed.achievement,
      parsed.fit,
      parsed.closing,
      profile.full_name ?? "",
    ].filter(Boolean).join("\n\n");

    return NextResponse.json({ text, language, labels });
  } catch (err) {
    console.error("[api/jobs/tailored-cover-letter POST]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Something went wrong. Please try again.", detail: message }, { status: 500 });
  }
}
