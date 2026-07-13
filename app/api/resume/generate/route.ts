import * as Sentry from "@sentry/nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import Anthropic from "@anthropic-ai/sdk";
import { createElement, type ReactElement } from "react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { computeSkillYears, computeTotalYearsExperience } from "@/lib/utils";
import { ResumePDF } from "../ResumePDF";
import type { Profile, PersonalProject, LinkedInRecommendation } from "@/types";
import type { DocumentProps } from "@react-pdf/renderer";
import { trackTokens } from "@/lib/track-tokens";

const SYSTEM_PROMPT = `You are a professional resume writer. Given a candidate's profile data, return ONLY valid JSON with this exact shape:

{
  "summary": "<2-3 sentence professional summary>",
  "skillGroups": [
    { "label": string, "skills": string[] }
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
- summary: 2-3 sentences, third-person present tense, no "I"/"my"/"me". Sentence 1: title + years + 2 specific named technologies. Sentence 2: one concrete thing they built or achieved (name the project/company if available). Sentence 3 (optional): a notable personal project by name if one exists in the data — skip this sentence if no projects are provided.
- skillGroups: categorize ALL skills from the input into labelled groups. Use exactly these short labels. Order groups as follows:
  1. "Frameworks" — UI frameworks, backend frameworks, ORMs, component libraries (e.g. React, Next.js, Express, Django, Prisma)
  2. "Languages" — programming and markup languages (e.g. TypeScript, Python, SQL, HTML, CSS)
  3. "Frontend" — browser-side tools, styling, build tools (e.g. Tailwind CSS, Vite, Webpack)
  4. "Backend" — server concepts, API patterns, runtime environments (e.g. Node.js, REST, GraphQL, WebSockets)
  5. "Databases" — databases and object stores (e.g. PostgreSQL, MongoDB, Redis, S3)
  6. "Tools" — CI/CD, cloud, containers, monitoring, version control (e.g. Docker, AWS, GitHub Actions, Datadog)
  Only include a group if it has at least one skill. Every skill from the input must appear in exactly one group. Do not invent skills.
- bullets: 3-5 per role, start with a past-tense action verb (Led, Built, Reduced, Designed, etc.)
- For currentlyWorking roles, use present-tense action verbs (Leads, Builds, etc.)
- Preserve ALL roles from the input — do not add or remove any
- startDate / endDate / currentlyWorking: copy exactly from input, do not change
- No fabrication: every bullet must be grounded in the input data. Do not invent percentages, team sizes, user counts, cost savings, or any metric not present in the input. If the role has no description, write general responsibility bullets based only on the title and company — never invent outcomes`;

type SkillGroup = { label: string; skills: string[] };

type GeneratedContent = {
  summary: string;
  skillGroups?: SkillGroup[];
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

function pdfResponse(buffer: ArrayBuffer): NextResponse {
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="resume.pdf"',
    },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } =
      await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const { data: profileData, error: profileError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (profileError || !profileData) {
      return NextResponse.json(
        { error: "Profile not found. Please save your profile first." },
        { status: 404 },
      );
    }

    const profile = profileData as Profile & { resume_generated_at?: string | null };
    const storagePath = `${userId}/generated-resume.pdf`;

    // Serve cached resume if profile hasn't changed since last generation.
    // Download server-side (bucket is private) and stream the bytes directly —
    // the browser cannot hit the storage URL directly without an auth token.
    const generatedAt = profile.resume_generated_at ? new Date(profile.resume_generated_at) : null;
    const updatedAt = profile.updated_at ? new Date(profile.updated_at) : null;
    if (generatedAt && updatedAt && generatedAt >= updatedAt && profile.resume_pdf_url) {
      const { data: cachedBlob, error: downloadError } = await insforge.storage
        .from("resumes")
        .download(storagePath);
      if (!downloadError && cachedBlob) {
        return pdfResponse(await cachedBlob.arrayBuffer());
      }
      // Download failed — fall through to regenerate
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI generation is not configured yet." },
        { status: 503 },
      );
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const profileInput = {
      fullName: profile.full_name,
      currentTitle: profile.current_title,
      yearsExperience: computeTotalYearsExperience(profile.work_experience),
      skills: profile.skills,
      workExperience: profile.work_experience,
      education: profile.education,
      personalProjects: profile.personal_projects,
    };

    const RESUME_CRITICAL_REMINDER = `CRITICAL RULES — apply to every word you write:
- Output MUST be valid JSON matching the schema above. Do not add any text outside the JSON.
- summary: THIRD PERSON ONLY. Never use "I", "my", or "me". No personal hobbies (music, theatre, sports). No mention of what the candidate loves or feels. Facts and professional impact only.
- No fabrication: every claim must come from the input data. Do not invent achievements, team sizes, or metrics.
- Forbidden phrases (never use in summary or bullets): "passion for", "aligns perfectly", "thrive in environments", "delivering high-value solutions", "empowering", "leverage", "synergize", "dynamic", "impactful", "unique combination of", "not just X but Y", "In my professional journey", "aligns seamlessly"
- Bullets: start with a strong past-tense action verb. Be specific — name tools, outcomes, or scale where the data supports it.`;

    const customInstructions = (profile.cover_letter_instructions as string | null)?.trim() ?? null;
    const summaryStyleNote = customInstructions
      ? `\n\nCANDIDATE WRITING STYLE (apply to the summary only — do NOT apply to bullets or skill groups):\n${customInstructions}`
      : "";

    const MODEL = "claude-sonnet-4-6";
    const response = await anthropic.messages.create({
      model: MODEL,
      system: `${SYSTEM_PROMPT}\n\n${RESUME_CRITICAL_REMINDER}${summaryStyleNote}`,
      temperature: 0.6,
      max_tokens: 1800,
      messages: [
        {
          role: "user",
          content: `Generate a professional resume for this candidate:\n\n${JSON.stringify(profileInput, null, 2)}`,
        },
      ],
    });

    const rawText = response.content[0]?.type === "text" ? response.content[0].text : null;
    const raw = rawText?.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim() ?? null;
    trackTokens(userId, "resume_generate", MODEL, response.usage.input_tokens, response.usage.output_tokens);
    if (!raw) {
      return NextResponse.json(
        { error: "Generation failed. Please try again." },
        { status: 500 },
      );
    }

    let generated: GeneratedContent;
    try {
      generated = JSON.parse(raw) as GeneratedContent;
    } catch {
      return NextResponse.json(
        { error: "Generation failed. Please try again." },
        { status: 500 },
      );
    }

    // Normalise group labels to short canonical forms
    const LABEL_MAP: Record<string, string> = {
      "frameworks & libraries": "Frameworks",
      "frameworks and libraries": "Frameworks",
      "backend & apis": "Backend",
      "backend and apis": "Backend",
      "databases & storage": "Databases",
      "databases and storage": "Databases",
      "tools & infrastructure": "Tools",
      "tools and infrastructure": "Tools",
      "infrastructure": "Tools",
    };
    if (generated.skillGroups) {
      generated.skillGroups = generated.skillGroups.map((g) => ({
        ...g,
        label: LABEL_MAP[g.label.toLowerCase()] ?? g.label,
      }));
    }

    // Strip any hallucinated skills — only keep skills the user actually added
    if (generated.skillGroups) {
      const allowed = new Set((profile.skills ?? []).map((s) => s.toLowerCase()));
      generated.skillGroups = generated.skillGroups
        .map((group) => ({
          ...group,
          skills: group.skills.filter((s) => allowed.has(s.toLowerCase())),
        }))
        .filter((group) => group.skills.length > 0);
    }

    // Merge per-role skills from profile into generated roles (GPT preserves order)
    generated.workExperience = generated.workExperience.map((genRole, i) => ({
      ...genRole,
      skills: (profile.work_experience ?? [])[i]?.skills ?? [],
    }));

    // Compute years of experience per skill from work history + personal projects
    const skillYears = computeSkillYears(profile.work_experience, profile.personal_projects as PersonalProject[] | null);

    const { data: recsData } = await insforge.database
      .from("linkedin_recommendations")
      .select("*")
      .eq("user_id", userId)
      .order("recommendation_date", { ascending: false });
    const recommendations = (recsData ?? []) as LinkedInRecommendation[];

    // Render PDF buffer
    // Cast required: renderToBuffer expects ReactElement<DocumentProps>, but our wrapper
    // component has a different Props shape — the runtime type is correct.
    const includeImages = req.nextUrl.searchParams.get("images") === "1";
    const element = createElement(
      ResumePDF,
      { profile, generated, skillYears, recommendations, includeImages },
    ) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    // Upload to InsForge Storage for caching — remove first so the same path can be reused
    const pdfBlob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
    await insforge.storage.from("resumes").remove(storagePath);
    const { data: uploadData, error: uploadError } = await insforge.storage
      .from("resumes")
      .upload(storagePath, pdfBlob);

    if (uploadError || !uploadData) {
      console.error("[api/resume/generate] storage upload error", uploadError);
      // Still return the PDF — caching failed but generation succeeded
    } else {
      // Mark generation timestamp so next request can serve the cached copy
      const { error: dbError } = await insforge.database
        .from("profiles")
        .update({ resume_pdf_url: uploadData.url, resume_generated_at: new Date().toISOString() })
        .eq("id", userId);
      if (dbError) {
        console.error("[api/resume/generate] db update error", dbError);
      }
    }

    // Stream the PDF directly — client receives bytes, no auth-gated URL needed
    return pdfResponse(buffer.buffer as ArrayBuffer);
  } catch (err) {
    Sentry.captureException(err);
    console.error("[api/resume/generate]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
