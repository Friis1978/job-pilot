import { NextRequest, NextResponse } from "next/server";
import { complete } from "@/lib/ai/claude";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage } from "@/lib/detect-language";
import type { Profile } from "@/types";
import { trackTokens } from "@/lib/track-tokens";
import { keyGuard } from "@/lib/ai/key-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    console.log("[motivation] POST START");
    const { id: jobId } = await params;

    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const keyBlocked = await keyGuard(userId);
    if (keyBlocked) return keyBlocked;

    const [jobRes, profileRes] = await Promise.all([
      insforge.database
        .from("jobs")
        .select("title, about_role, responsibilities, requirements")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single(),
      insforge.database
        .from("profiles")
        .select("current_title, skills, motivation, career_vision, energy_tasks, personal_interests")
        .eq("id", userId)
        .single(),
    ]);

    if (jobRes.error || !jobRes.data) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (profileRes.error || !profileRes.data) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const job = jobRes.data;
    const profile = profileRes.data as Partial<Profile>;

    const jobContext = [
      `Role title: ${job.title}`,
      job.about_role ? `Role description: ${job.about_role}` : "",
      job.responsibilities?.length ? `Responsibilities: ${(job.responsibilities as string[]).join("; ")}` : "",
      job.requirements?.length ? `Requirements: ${(job.requirements as string[]).join("; ")}` : "",
    ].filter(Boolean).join("\n");

    const isCoverLetter = (s: string) => /^Hi\b|^Dear\b|Best regards|Yours sincerely|Kind regards/i.test(s);
    const profileContext = [
      profile.current_title ? `Title: ${profile.current_title}` : "",
      profile.skills?.length ? `Skills: ${(profile.skills as string[]).join(", ")}` : "",
      profile.motivation && !isCoverLetter(profile.motivation) ? `Motivation: ${profile.motivation}` : "",
      profile.career_vision ? `Career vision: ${profile.career_vision}` : "",
      profile.energy_tasks ? `Energised by: ${profile.energy_tasks}` : "",
      profile.personal_interests ? `Interests: ${profile.personal_interests}` : "",
    ].filter(Boolean).join("\n");

    const allJobText = [job.title, job.about_role, ...(job.requirements as string[] ?? []), ...(job.responsibilities as string[] ?? [])].filter(Boolean).join(" ");
    const detectedLang = detectLanguage(allJobText);
    const langInstruction = detectedLang !== "en"
      ? ` Write exclusively in the language of the job post (detected: ${detectedLang}). Do not use English.`
      : "";

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI generation is not configured (missing ANTHROPIC_API_KEY)." }, { status: 503 });
    }

    const systemPrompt = `You write a resume motivation paragraph in first person ("I"). 3-5 sentences explaining what the candidate brings to this specific role and why they are motivated for it. Match the candidate's concrete skills and experience to the role's needs.${langInstruction}

Rules:
- Write in first person ("I have", "I bring", "My experience")
- Focus on what the candidate offers THIS role specifically
- NO greeting, NO closing, NO sign-off
- NO person names, NO company or organisation names
- NO bullet points, headers, or markdown
- Plain prose sentences only
- Use only facts present in the input`;

    const userMessage = `CANDIDATE:\n${profileContext}\n\nROLE:\n${jobContext}\n\nWrite a 3-5 sentence first-person motivation paragraph. What does the candidate bring to this role? No greeting. No closing. No names.`;

    const { text, usage, model } = await complete({
      userId,
      system: systemPrompt,
      maxTokens: 400,
      effort: "low",
      user: userMessage,
    });

    trackTokens(userId, "resume_motivation", model, usage.input_tokens, usage.output_tokens);

    await insforge.database
      .from("jobs")
      .update({ resume_motivation: text })
      .eq("id", jobId)
      .eq("user_id", userId);

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[motivation] POST ERROR:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;
    const { text } = (await req.json()) as { text?: string };
    if (typeof text !== "string") return NextResponse.json({ error: "Invalid request." }, { status: 400 });

    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    await insforge.database
      .from("jobs")
      .update({ resume_motivation: text || null })
      .eq("id", jobId)
      .eq("user_id", authData.user.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[api/jobs/resume-motivation PATCH]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
