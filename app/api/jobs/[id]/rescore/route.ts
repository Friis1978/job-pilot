import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { scoreJob } from "@/agent/find-jobs";
import type { Profile } from "@/types";

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

  // Load job
  const { data: jobData, error: jobError } = await insforge.database
    .from("jobs")
    .select("id, title, company, location, about_role")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (jobError || !jobData) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  // Load profile
  const { data: profileData, error: profileError } = await insforge.database
    .from("profiles")
    .select("current_title, years_experience, experience_level, skills, work_experience")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const profile = profileData as Profile;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  const scored = await scoreJob(
    {
      id: jobData.id,
      title: jobData.title,
      company: jobData.company,
      location: jobData.location ?? null,
      description: jobData.about_role ?? "",
      url: "",
      salary: null,
      job_type: null,
      source: "url" as const,
    },
    profile,
    openai,
    jobData.location ?? "",
  );

  if (!scored) {
    return NextResponse.json({ error: "Scoring failed. Please try again." }, { status: 500 });
  }

  const { error: updateError } = await insforge.database
    .from("jobs")
    .update({
      matched_skills: scored.matchedSkills,
      missing_skills: scored.missingSkills,
      match_score: scored.matchScore,
      match_reason: scored.matchReason,
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
