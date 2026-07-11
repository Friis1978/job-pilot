import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage } from "@/lib/detect-language";
import type { Profile } from "@/types";
import { trackTokens } from "@/lib/track-tokens";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content: `You write a motivation section for a resume. Write in first person, maximum 8 lines, prose format (no bullet points, no headers). Be specific to this company and role — mention the company by name and connect the candidate's background and interests to what this role offers. Do not sound like a cover letter opening or a suck-up — be genuine, direct, and grounded. Never fabricate experience or achievements not present in the profile. Write plain text only, no markdown.${langInstruction}`,
        },
        {
          role: "user",
          content: `Candidate profile:\n${profileContext}\n\nJob:\n${jobContext}\n\nWrite the motivation section now.`,
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    trackTokens(userId, "resume_motivation", "gpt-4o-mini", completion.usage?.prompt_tokens ?? 0, completion.usage?.completion_tokens ?? 0);

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
