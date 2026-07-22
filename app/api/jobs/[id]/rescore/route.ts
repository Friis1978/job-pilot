import * as Sentry from "@sentry/nextjs";
import { NextRequest, NextResponse } from "next/server";
import { createInsforgeServer } from "@/lib/insforge-server";
import { scoreJob } from "@/agent/find-jobs";
import type { Profile } from "@/types";
import { keyGuard } from "@/lib/ai/key-guard";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });


  const keyBlocked = await keyGuard(user.id);

  if (keyBlocked) return keyBlocked;

  // Load job
  const { data: jobData, error: jobError } = await insforge.database
    .from("jobs")
    .select("id, title, company, location, about_role, full_post_text")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (jobError || !jobData) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  // Load profile
  const { data: profileData, error: profileError } = await insforge.database
    .from("profiles")
    .select("current_title, years_experience, experience_level, skills, work_experience, personal_projects, spoken_languages")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const profile = profileData as Profile;

  const scored = await scoreJob(
    {
      id: jobData.id,
      title: jobData.title,
      company: jobData.company,
      location: jobData.location ?? null,
      // full_post_text is the text the job was originally scored against.
      // about_role is an AI-extracted, shortened version, so scoring from it
      // produced a different skill list than the first run — the rescore was
      // reading different source material, not just resampling the model.
      // `||` not `??`: 72 existing rows have a NULL full_post_text and an empty
      // string must fall back too, or the job gets scored against no text at all.
      description: (jobData.full_post_text as string | null) || jobData.about_role || "",
      url: "",
      salary: null,
      job_type: null,
      source: "url" as const,
    },
    profile,
    user.id,
  );

  if (!scored) {
    Sentry.captureMessage("scoreJob returned null", { level: "error", extra: { jobId: id } });
    return NextResponse.json({ error: "Scoring failed. Please try again." }, { status: 500 });
  }

  const { error: updateError } = await insforge.database
    .from("jobs")
    .update({
      matched_skills: scored.matchedSkills,
      missing_skills: scored.missingSkills,
      match_score: scored.matchScore,
      match_reason: scored.matchReason,
      experience_score: scored.experienceScore,
      seniority_score: scored.seniorityScore,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save updated skills." }, { status: 500 });
  }

  return NextResponse.json({
    matchedSkills: scored.matchedSkills,
    missingSkills: scored.missingSkills,
    matchScore: scored.matchScore,
    matchReason: scored.matchReason,
  });
}
