import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { completeJson, isClaudeConfigured } from "@/lib/ai/claude";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ProfileFormInput } from "@/types";
import { trackTokens } from "@/lib/track-tokens";
import { keyGuard } from "@/lib/ai/key-guard";

const SYSTEM_PROMPT = `You are a resume parser. Extract structured profile information from the resume text provided.

Return ONLY valid JSON with this exact shape — use empty string "" for missing text fields, empty array [] for missing arrays, false for missing booleans:

{
  "fullName": string,
  "phone": string,
  "location": string,
  "linkedinUrl": string,
  "portfolioUrl": string,
  "currentTitle": string,
  "experienceLevel": string,
  "skills": string[],
  "industries": string[],
  "workExperience": [
    {
      "company": string,
      "title": string,
      "startDate": string,
      "endDate": string,
      "currentlyWorking": boolean,
      "responsibilities": string
    }
  ],
  "educations": [
    {
      "degree": string,
      "field": string,
      "institution": string,
      "year": string
    }
  ],
  "personalProjects": [
    {
      "name": string,
      "description": string,
      "url": string,
      "githubUrl": string,
      "skills": string[],
      "startDate": string,
      "endDate": string,
      "currentlyWorking": boolean
    }
  ]
}

Rules:
- experienceLevel must be one of: "junior", "mid", "senior", "lead" — infer from years and seniority of roles
- startDate / endDate: YYYY-MM format (e.g. "2021-03") — use YYYY-01 if only year is given
- currentlyWorking: true if the role has no end date or says "present"
- endDate: "" when currentlyWorking is true
- responsibilities: one paragraph summarising key responsibilities and achievements for the role
- workExperience: maximum 10 most recent roles, oldest first
- skills: individual technology or skill names, not sentences (e.g. ["React", "TypeScript", "AWS"])
- educations: all degrees found, most recent first; degree must be one of "high_school", "associate", "bachelor", "master", "phd", "other", or "" if not determinable
- personalProjects: side projects, open source work, or personal builds listed on the resume; omit if none found
- Do NOT extract email — leave it out of the response entirely
- Do NOT guess preference fields (jobTitlesSeeking, remotePreference, salary, etc.)`;

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } =
      await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const keyBlocked = await keyGuard(userId);
    if (keyBlocked) return keyBlocked;

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Resume file is empty. Please try a different file." },
        { status: 422 },
      );
    }

    let extractedText: string;
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      extractedText = result.text;
    } catch (parseErr) {
      console.error("[api/resume/extract] pdf-parse threw:", parseErr);
      return NextResponse.json(
        { error: "Could not read this PDF. Please try a different file." },
        { status: 422 },
      );
    }

    if (!extractedText || extractedText.trim().length < 100) {
      return NextResponse.json(
        {
          error:
            "Could not extract text from this PDF. Please try a different file.",
        },
        { status: 422 },
      );
    }

    if (!isClaudeConfigured()) {
      return NextResponse.json(
        { error: "AI extraction is not configured yet." },
        { status: 503 },
      );
    }

    const trimmedText = extractedText.slice(0, 12000);

    const { data: parsed, usage, model } = await completeJson<Partial<ProfileFormInput>>({
      userId,
      maxTokens: 4000,
      effort: "low",
      system: SYSTEM_PROMPT,
      user: `Extract profile information from this resume:\n\n${trimmedText}`,
    });

    trackTokens(userId, "resume_extract", model, usage.input_tokens, usage.output_tokens);

    if (!parsed) {
      return NextResponse.json(
        { error: "Extraction failed. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: parsed });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[api/resume/extract]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
