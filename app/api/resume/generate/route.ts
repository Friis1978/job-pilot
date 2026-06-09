import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import OpenAI from "openai";
import { createElement, type ReactElement } from "react";
import { createInsforgeServer } from "@/lib/insforge-server";
import { ResumePDF } from "../ResumePDF";
import type { Profile } from "@/types";
import type { DocumentProps } from "@react-pdf/renderer";

const SYSTEM_PROMPT = `You are a professional resume writer. Given a candidate's profile data, return ONLY valid JSON with this exact shape:

{
  "summary": "<2-3 sentence professional summary>",
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
- summary: 2-3 sentences, third-person present tense, no first-person "I"
- bullets: 3-5 per role, start with a past-tense action verb (Led, Built, Reduced, Designed, etc.)
- For currentlyWorking roles, use present-tense action verbs (Leads, Builds, etc.)
- Preserve ALL roles from the input — do not add or remove any
- startDate / endDate / currentlyWorking: copy exactly from input, do not change`;

type GeneratedContent = {
  summary: string;
  workExperience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    currentlyWorking: boolean;
    bullets: string[];
  }[];
};

export async function POST(): Promise<NextResponse> {
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

    const profile = profileData as Profile;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "AI generation is not configured yet." },
        { status: 503 },
      );
    }

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
          content: `Generate a professional resume for this candidate:\n\n${JSON.stringify(profileInput, null, 2)}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content;
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

    // Render PDF buffer
    // Cast required: renderToBuffer expects ReactElement<DocumentProps>, but our wrapper
    // component has a different Props shape — the runtime type is correct.
    const element = createElement(
      ResumePDF,
      { profile, generated },
    ) as unknown as ReactElement<DocumentProps>;
    const buffer = await renderToBuffer(element);

    // Upload to InsForge Storage — remove first so the same path can be reused
    const storagePath = `${userId}/generated-resume.pdf`;
    await insforge.storage.from("resumes").remove(storagePath);

    const pdfBlob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
    const { data: uploadData, error: uploadError } = await insforge.storage
      .from("resumes")
      .upload(storagePath, pdfBlob);

    if (uploadError || !uploadData) {
      console.error("[api/resume/generate] storage upload error", uploadError);
      return NextResponse.json(
        { error: "Failed to save resume. Please try again." },
        { status: 500 },
      );
    }

    const url = insforge.storage.from("resumes").getPublicUrl(storagePath);

    // Update profile with generated resume URL
    const { error: dbError } = await insforge.database
      .from("profiles")
      .update({ resume_pdf_url: url })
      .eq("id", userId);

    if (dbError) {
      // Log but don't fail — PDF is generated and URL is valid
      console.error("[api/resume/generate] db update error", dbError);
    }

    return NextResponse.json({ data: { url } });
  } catch (err) {
    console.error("[api/resume/generate]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
