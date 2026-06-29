import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ProfileFormInput } from "@/types";

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
- Do NOT extract email — leave it out of the response entirely
- Do NOT guess preference fields (jobTitlesSeeking, remotePreference, salary, etc.)`;

export async function POST(): Promise<NextResponse> {
  try {
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } =
      await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const { data: blob, error: storageError } = await insforge.storage
      .from("resumes")
      .download(`${userId}/resume.pdf`);

    if (storageError || !blob) {
      return NextResponse.json(
        { error: "No resume found. Please upload a resume first." },
        { status: 404 },
      );
    }

    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Resume file is empty. Please re-upload and try again." },
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

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI extraction is not configured yet." },
        { status: 503 },
      );
    }

    // Trim extracted text to ~12k chars to stay well within context limits
    const trimmedText = extractedText.slice(0, 12000);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Extract profile information from this resume:\n\n${trimmedText}`,
        },
      ],
    });

    const choice = response.choices[0];
    if (choice.finish_reason === "length") {
      console.warn("[api/resume/extract] response truncated — increase max_tokens");
    }
    const raw = choice.message.content;
    if (!raw) {
      return NextResponse.json(
        { error: "Extraction failed. Please try again." },
        { status: 500 },
      );
    }

    let parsed: Partial<ProfileFormInput>;
    try {
      parsed = JSON.parse(raw) as Partial<ProfileFormInput>;
    } catch {
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
