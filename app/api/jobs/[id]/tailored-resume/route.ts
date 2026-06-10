import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import OpenAI from "openai";
import { createElement, type ReactElement } from "react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { ResumePDF } from "@/app/api/resume/ResumePDF";
import type { Profile } from "@/types";
import type { DocumentProps } from "@react-pdf/renderer";

const SYSTEM_PROMPT = `You are a professional resume writer tailoring a candidate's resume for a specific company and role. Return ONLY valid JSON with this exact shape:

{
  "summary": "<2-3 sentence professional summary>",
  "skills": ["<skill>", ...],
  "workExperience": [
    {
      "company": string,
      "title": string,
      "startDate": string,
      "endDate": string,
      "currentlyWorking": boolean,
      "bullets": ["<action verb phrase>", ...]
    }
  ]
}

Rules:
- summary: 2-3 sentences, third-person present tense, no first-person "I". Mirror the target company's language, values, and technical focus. Make it clear this candidate is a strong fit for this specific role.
- skills: return ALL skills from the candidate's profile — do not add or remove any. Reorder them so the skills most relevant to this role and company appear first. Skills that directly match the job requirements or the company's tech stack should be listed at the top.
- bullets: 3-5 per role, start with a past-tense action verb. Rewrite bullets to emphasise skills and experiences that are most relevant to the target company's tech stack, culture, and role requirements. For the most recent/relevant roles, prioritise achievements that align with what the company cares about.
- For currentlyWorking roles, use present-tense action verbs (Leads, Builds, etc.)
- Preserve ALL roles from the input — do not add or remove any
- startDate / endDate / currentlyWorking: copy exactly from input, do not change
- Do NOT fabricate experience — only reframe and emphasise what is genuinely there`;

type GeneratedContent = {
  summary: string;
  skills: string[];
  workExperience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    currentlyWorking: boolean;
    bullets: string[];
  }[];
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
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const [jobRes, profileRes] = await Promise.all([
      insforge.database
        .from("jobs")
        .select("title, company, about_role, matched_skills, missing_skills, company_research")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single(),
      insforge.database
        .from("profiles")
        .select("*")
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
    const profile = profileRes.data as Profile;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI generation is not configured." }, { status: 503 });
    }

    const companyContext = job.company_research
      ? `COMPANY RESEARCH:\n${JSON.stringify(job.company_research, null, 2)}`
      : "";

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const profileInput = {
      fullName: profile.full_name,
      currentTitle: profile.current_title,
      yearsExperience: profile.years_experience,
      skills: profile.skills,
      workExperience: profile.work_experience,
      education: profile.education,
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `TARGET ROLE: ${job.title} at ${job.company}
Job description: ${job.about_role ?? "Not provided"}
Skills this role requires that the candidate has: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
Skills the candidate is missing: ${(job.missing_skills as string[] | null)?.join(", ") ?? "None"}
${companyContext}

CANDIDATE PROFILE:
${JSON.stringify(profileInput, null, 2)}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
    }

    let generated: GeneratedContent;
    try {
      generated = JSON.parse(raw) as GeneratedContent;
    } catch {
      return NextResponse.json({ error: "Generation failed. Please try again." }, { status: 500 });
    }

    const element = createElement(
      ResumePDF,
      { profile, generated },
    ) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: userId,
      event: "tailored_resume_generated",
      properties: { userId, jobId, company: job.company },
    });
    await posthog.shutdown();

    const safeCompany = job.company.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="resume-${safeCompany}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[api/jobs/tailored-resume]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
