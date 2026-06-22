import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import OpenAI from "openai";
import { createElement, type ReactElement } from "react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { getPostHogClient } from "@/lib/posthog-server";
import { computeSkillYears } from "@/lib/utils";
import { ResumePDF } from "@/app/api/resume/ResumePDF";
import type { Profile } from "@/types";
import type { DocumentProps } from "@react-pdf/renderer";

const SYSTEM_PROMPT = `You are a professional resume writer tailoring a candidate's resume for a specific company and role. Return ONLY valid JSON with this exact shape:

{
  "summary": "<2-3 sentence professional summary>",
  "skillGroups": [
    { "label": "<category name>", "skills": ["<skill>", ...] }
  ],
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
- summary: 2-3 sentences, first-person present tense. NEVER mention the company name, the company's products, or the company's mission — not even once. You may reference the company's culture, values, or domain (e.g. "healthcare", "fintech") in general terms only. This is the most important field — make it specific to this exact role, not generic.
  - If personal interests are provided, weave in a brief human touch where it fits naturally — one clause max, only if it adds something genuine
  - Mirror the role's language, values, and technical focus from the job description and company research
  - If a key achievement is provided, use it to anchor one sentence as concrete evidence
  - If motivation or career vision is provided, reflect what drives the candidate in a way that connects to this type of work
  - If energy tasks are provided and they match the role's day-to-day work, surface that fit naturally
  - If personal interests are provided, close the summary with a single natural sentence about who the candidate is outside of work — keep it brief and genuine, not forced
  - Every sentence must earn its place — no filler like "passionate professional" or "results-driven"
- skillGroups: Group ALL skills from the candidate's profile into meaningful technology categories (e.g. "Frontend", "Backend", "DevOps", "Languages", "Data", "Tools"). Do not add, remove, or rename any skill — only categorise them. Order within each group is not important. Group related technologies together — e.g. BaaS/cloud database platforms like Supabase, Insforge, Firebase, PlanetScale belong in the same group; AI tools like Claude, OpenAI, GitHub Copilot belong together; testing tools like Vitest, Playwright, Jest belong together.
- bullets: 3-5 per role, start with a past-tense action verb. Rewrite bullets to emphasise skills and experiences that are most relevant to the target company's tech stack, culture, and role requirements. For the most recent/relevant roles, prioritise achievements that align with what the company cares about.
- For currentlyWorking roles, use present-tense action verbs (Leads, Builds, etc.)
- Preserve ALL roles from the input — do not add or remove any
- startDate / endDate / currentlyWorking: copy exactly from input, do not change
- Do NOT fabricate experience — only reframe and emphasise what is genuinely there`;

type SkillGroup = { label: string; skills: string[] };

type GeneratedContent = {
  summary: string;
  skillGroups: SkillGroup[];
  workExperience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    currentlyWorking: boolean;
    bullets: string[];
    skills?: string[];
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
        .select("title, company, about_role, responsibilities, requirements, matched_skills, missing_skills, company_research")
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

    const skillYears = computeSkillYears(profile.work_experience);
    const skillYearsStr = Object.entries(skillYears)
      .sort((a, b) => b[1] - a[1])
      .map(([s, y]) => `${s} ${y}yr`)
      .join(", ");

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
Job description: ${job.about_role ?? "Not provided"}${(job.requirements as string[] | null)?.length ? `\nRequirements:\n${(job.requirements as string[]).map((r) => `- ${r}`).join("\n")}` : ""}${(job.responsibilities as string[] | null)?.length ? `\nResponsibilities:\n${(job.responsibilities as string[]).map((r) => `- ${r}`).join("\n")}` : ""}
Skills this role requires that the candidate has: ${(job.matched_skills as string[] | null)?.join(", ") ?? "None"}
Skills the candidate is missing: ${(job.missing_skills as string[] | null)?.join(", ") ?? "None"}${skillYearsStr ? `\nCandidate's skill experience (years per skill): ${skillYearsStr}` : ""}
${companyContext}

CANDIDATE PROFILE:
${JSON.stringify(profileInput, null, 2)}${(profile.personal_interests as string | null) ? `\n\nPERSONAL INTERESTS:\n${profile.personal_interests}` : ""}${(profile.motivation as string | null) || (profile.proud_achievement as string | null) || (profile.energy_tasks as string | null) || (profile.career_vision as string | null) ? `

WHAT DRIVES THIS CANDIDATE:${(profile.motivation as string | null) ? `\nMotivation: ${profile.motivation}` : ""}${(profile.proud_achievement as string | null) ? `\nKey achievement: ${profile.proud_achievement}` : ""}${(profile.energy_tasks as string | null) ? `\nWhat gives them energy: ${profile.energy_tasks}` : ""}${(profile.career_vision as string | null) ? `\nCareer vision: ${profile.career_vision}` : ""}` : ""}`,
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

    const matchedSkills = (job.matched_skills as string[] | null) ?? [];

    // Verify each matched skill actually appears in the job text — the scorer
    // sometimes adds common tools (Jira, Figma, GitHub) that aren't in the posting.
    const jobText = [
      job.about_role ?? "",
      ...((job.requirements as string[] | null) ?? []),
      ...((job.responsibilities as string[] | null) ?? []),
    ].join(" ").toLowerCase();
    const FRONTEND_KEYWORDS = [
      "react", "vue", "angular", "svelte", "next", "nuxt", "remix",
      "gatsby", "astro", "solid", "qwik", "ember", "preact", "htmx", "alpine",
    ];
    const isFrontendFramework = (skill: string) => {
      const lower = skill.toLowerCase();
      return FRONTEND_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + ".") || lower.startsWith(kw + " ") || lower.startsWith(kw + "js") || lower.startsWith(kw + "-"));
    };

    const verifiedMatchedSkills = matchedSkills
      .filter((s) => jobText.includes(s.toLowerCase()))
      .sort((a, b) => {
        const aFE = isFrontendFramework(a) ? 0 : 1;
        const bFE = isFrontendFramework(b) ? 0 : 1;
        return aFE - bFE;
      });

    const jobSkillsLower = new Set(verifiedMatchedSkills.map((s) => s.toLowerCase()));

    // If AI returned flat `skills` instead of `skillGroups`, convert it
    if (!generated.skillGroups?.length && (generated as unknown as { skills?: string[] }).skills?.length) {
      generated.skillGroups = [{ label: "Skills", skills: (generated as unknown as { skills: string[] }).skills }];
    }

    // Ensure no profile skills were dropped by the AI — append orphaned skills to "Other"
    const allGroupedLower = new Set(
      (generated.skillGroups ?? []).flatMap((g) => g.skills.map((s) => s.toLowerCase()))
    );
    const orphaned = (profile.skills as string[] | null ?? []).filter(
      (s) => !allGroupedLower.has(s.toLowerCase())
    );
    if (orphaned.length > 0) {
      generated.skillGroups = [...(generated.skillGroups ?? []), { label: "Other", skills: orphaned }];
    }

    // Prepend a "Required" group for verified matched skills, stripped from other groups
    if (verifiedMatchedSkills.length > 0) {
      generated.skillGroups = [
        { label: "Required", skills: verifiedMatchedSkills },
        ...(generated.skillGroups ?? [])
          .map((g) => ({ ...g, skills: g.skills.filter((s) => !jobSkillsLower.has(s.toLowerCase())) }))
          .filter((g) => g.skills.length > 0),
      ];
    }

    // Persist summary + full generated content (after post-processing so Required group is included)
    await insforge.database
      .from("jobs")
      .update({ tailored_summary: generated.summary, tailored_resume_content: generated })
      .eq("id", jobId)
      .eq("user_id", userId);

    // Merge per-role skills from profile, prioritising job-relevant skills first
    generated.workExperience = generated.workExperience.map((role, i) => {
      const roleSkills = profile.work_experience?.[i]?.skills;
      if (!roleSkills?.length) return role;
      const sorted = [...roleSkills].sort((a, b) => {
        const aMatch = jobSkillsLower.has(a.toLowerCase()) ? 0 : 1;
        const bMatch = jobSkillsLower.has(b.toLowerCase()) ? 0 : 1;
        return aMatch - bMatch;
      });
      return { ...role, skills: sorted };
    });

    const element = createElement(
      ResumePDF,
      { profile, generated, skillYears },
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
