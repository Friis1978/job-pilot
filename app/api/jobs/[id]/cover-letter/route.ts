import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { createInsforgeServer } from "@/lib/insforge-server";
import { detectLanguage, LANGUAGE_LABELS } from "@/lib/detect-language";
import { CoverLetterPDF } from "./CoverLetterPDF";
import type { Profile } from "@/types";

// GET — download cover letter as PDF
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: jobId } = await params;
    const includePhoto = req.nextUrl.searchParams.get("photo") !== "0";
    const insforge = await createInsforgeServer();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = authData.user.id;

    const [jobRes, profileRes] = await Promise.all([
      insforge.database
        .from("jobs")
        .select("title, company, about_role, responsibilities, requirements, cover_letter")
        .eq("id", jobId)
        .eq("user_id", userId)
        .single(),
      insforge.database
        .from("profiles")
        .select("full_name, email, phone, portfolio_url, avatar_url")
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
    const profile = profileRes.data as Pick<Profile, "full_name" | "email" | "phone" | "portfolio_url" | "avatar_url">;

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

    // avatars bucket is public — pass URL directly, react-pdf fetches it during render
    const avatarUrl = includePhoto && profile.avatar_url ? profile.avatar_url : null;

    // Build contact parts — email falls back to auth email if not saved in profile
    const email = profile.email || authData.user.email || null;
    const contactParts: string[] = [];
    if (profile.phone) contactParts.push(profile.phone);
    if (email) contactParts.push(email);
    if (profile.portfolio_url) {
      contactParts.push(profile.portfolio_url.replace(/^https?:\/\//, "").replace(/\/$/, ""));
    }

    const element = createElement(CoverLetterPDF, {
      fullName: profile.full_name ?? "",
      jobTitle: job.title,
      company: job.company,
      coverLetterText: job.cover_letter,
      contactParts,
      avatarUrl,
      labels,
    }) as unknown as ReactElement<DocumentProps>;

    const buffer = await renderToBuffer(element);
    const safeCompany = job.company.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cover-letter-${safeCompany}.pdf"`,
      },
    });
  } catch (err) {
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
    console.error("[api/jobs/cover-letter PATCH]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
