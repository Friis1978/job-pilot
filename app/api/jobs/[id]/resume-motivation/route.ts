import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage } from "@/lib/detect-language";
import type { Profile } from "@/types";
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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const [jobRes, profileRes] = await Promise.all([
      insforge.database
        .from("jobs")
        .select("title, company, about_role, responsibilities, requirements, company_research")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single(),
      insforge.database
        .from("profiles")
        .select("full_name, current_title, skills, work_experience, motivation, career_vision, energy_tasks, personal_interests, company_type_preference")
        .eq("id", userId)
        .single(),
    ]);

    if (jobRes.error || !jobRes.data) return NextResponse.json({ error: "Job not found." }, { status: 404 });
    if (profileRes.error || !profileRes.data) return NextResponse.json({ error: "Profile not found." }, { status: 404 });

    const job = jobRes.data;
    const profile = profileRes.data as Partial<Profile>;

    const jobContext = [
      `Company: ${job.company}`,
      `Role: ${job.title}`,
      job.about_role ? `About the role: ${job.about_role}` : "",
      job.responsibilities?.length ? `Responsibilities: ${(job.responsibilities as string[]).join("; ")}` : "",
      job.requirements?.length ? `Requirements: ${(job.requirements as string[]).join("; ")}` : "",
      job.company_research ? `Company context: ${JSON.stringify(job.company_research).slice(0, 800)}` : "",
    ].filter(Boolean).join("\n");

    const profileContext = [
      profile.current_title ? `Current title: ${profile.current_title}` : "",
      profile.skills?.length ? `Skills: ${(profile.skills as string[]).join(", ")}` : "",
      profile.motivation ? `Personal motivation: ${profile.motivation}` : "",
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

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const MODEL = "claude-sonnet-4-6";

    const systemPrompt = `You write a motivation section for a tailored resume. It is a short paragraph (3–5 sentences) explaining why this candidate is a good fit for this specific role — drawing on their background, values, and what motivates them professionally. It is NOT a cover letter: no greeting, no closing, no "Hi [Company]", no "Best regards". Plain prose only — no bullet points, no headers, no markdown.${langInstruction}

Structure:
1. Who the candidate is professionally: title + domain + 1–2 specific technologies. One sentence.
2. What they bring that is relevant to this role — one concrete aspect from their work history or skills that matches the job. Name it specifically.
3. Why this type of work fits them — use the candidate's motivation, career_vision, or energy_tasks to explain the genuine connection. Factual, not flattering.
4. (Optional) One more relevant strength or interest if the profile data supports it.

Hard rules:
- No greeting, no closing, no candidate name, no company name.
- Never open a sentence with "I".
- No three-part lists — break into separate statements.
- Forbidden words: excited, passionate, thrilled, inspired, eager, leverage, aligns, dynamic, impactful, synergize, seamlessly, transformative.
- No fabrication — only use details present in the profile and job data.
- Return plain text only.`;

    const completion = await anthropic.messages.create({
      model: MODEL,
      system: systemPrompt,
      max_tokens: 400,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: `CANDIDATE DATA (use as source material only):\n${profileContext}\n\nTARGET JOB:\n${jobContext}\n\nWrite a 3–5 sentence motivation paragraph. NO greeting, NO closing, NO candidate name, NO company name. Plain prose only.`,
        },
      ],
    });

    const text = completion.content[0]?.type === "text" ? completion.content[0].text.trim() : "";
    trackTokens(userId, "resume_motivation", MODEL, completion.usage.input_tokens, completion.usage.output_tokens);

    await insforge.database
      .from("jobs")
      .update({ resume_motivation: text })
      .eq("id", jobId)
      .eq("user_id", userId);

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[api/jobs/resume-motivation POST]", err);
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
