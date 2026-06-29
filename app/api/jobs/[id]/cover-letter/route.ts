import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { PDFDocument } from "pdf-lib";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage, LANGUAGE_LABELS } from "@/lib/detect-language";
import { computeSkillYears } from "@/lib/utils";
import { CoverLetterPDF } from "./CoverLetterPDF";
import { ResumePDF } from "@/app/api/resume/ResumePDF";
import type { Profile } from "@/types";

// GET — download cover letter as PDF (optionally with resume appended)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;
    const includePhoto = req.nextUrl.searchParams.get("photo") !== "0";
    const includeResume = req.nextUrl.searchParams.get("resume") === "1";
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const [jobRes, profileRes] = await Promise.all([
      insforge.database
        .from("jobs")
        .select("title, company, about_role, responsibilities, requirements, cover_letter, tailored_resume_content")
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

    if (!job.cover_letter) {
      return NextResponse.json({ error: "No cover letter to download. Generate one first." }, { status: 400 });
    }

    // Detect language from all available job text
    const allJobText = [
      job.title ?? "",
      job.about_role ?? "",
      ...((job.responsibilities as string[] | null) ?? []),
      ...((job.requirements as string[] | null) ?? []),
    ].join(" ");
    const lang = detectLanguage(allJobText || job.cover_letter);
    const labels = LANGUAGE_LABELS[lang] ?? LANGUAGE_LABELS.en;

    const avatarUrl = includePhoto && profile.avatar_url ? profile.avatar_url : null;

    const email = profile.email || authData.user.email || null;
    const contactParts: string[] = [];
    if (profile.phone) contactParts.push(profile.phone);
    if (email) contactParts.push(email);
    if (profile.portfolio_url) {
      contactParts.push(profile.portfolio_url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
    }

    const safeCompany = job.company.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Render cover letter PDF
    const clElement = createElement(CoverLetterPDF, {
      fullName: profile.full_name ?? "",
      jobTitle: job.title,
      company: job.company,
      coverLetterText: job.cover_letter,
      contactParts,
      avatarUrl,
      labels,
    }) as unknown as ReactElement<DocumentProps>;
    const clBuffer = await renderToBuffer(clElement);

    // If resume not requested or no stored tailored content, return cover letter only
    const tailoredContent = job.tailored_resume_content as Record<string, unknown> | null;
    if (!includeResume || !tailoredContent) {
      return new NextResponse(new Uint8Array(clBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="cover-letter-${safeCompany}.pdf"`,
        },
      });
    }

    // Render resume PDF
    const skillYears = computeSkillYears(profile.work_experience);
    const resumeElement = createElement(ResumePDF, {
      profile,
      generated: tailoredContent as Parameters<typeof ResumePDF>[0]["generated"],
      skillYears,
    }) as unknown as ReactElement<DocumentProps>;
    const resumeBuffer = await renderToBuffer(resumeElement);

    // Merge cover letter + resume into one PDF
    const merged = await PDFDocument.create();
    for (const buf of [clBuffer, resumeBuffer]) {
      const src = await PDFDocument.load(buf);
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    }
    const mergedBuffer = Buffer.from(await merged.save());

    return new NextResponse(new Uint8Array(mergedBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="application-${safeCompany}.pdf"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[api/jobs/cover-letter GET]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}

// PATCH — save edited cover letter text
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;
    const { text } = (await req.json()) as { text?: string };

    if (typeof text !== "string") {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Archive existing cover letter before overwriting
    const { data: existingJob } = await insforge.database
      .from("jobs")
      .select("cover_letter")
      .eq("id", jobId)
      .eq("user_id", authData.user.id)
      .single();
    if (existingJob?.cover_letter) {
      await insforge.database
        .from("cover_letter_history")
        .insert([{ job_id: jobId, user_id: authData.user.id, text: existingJob.cover_letter, source: "edited" }]);
    }

    const { error } = await insforge.database
      .from("jobs")
      .update({ cover_letter: text })
      .eq("id", jobId)
      .eq("user_id", authData.user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to save." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[api/jobs/cover-letter PATCH]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
