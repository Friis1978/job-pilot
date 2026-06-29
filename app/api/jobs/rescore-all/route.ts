import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createInsforgeServer } from "@/lib/insforge-server";
import { scoreJob } from "@/agent/find-jobs";
import type { Profile } from "@/types";

export async function POST() {
  const insforge = await createInsforgeServer();
  const {
    data: { user },
  } = await insforge.auth.getCurrentUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: jobs, error: jobsError } = await insforge.database
    .from("jobs")
    .select("id, title, company, location, about_role")
    .eq("user_id", user.id)
    .not("about_role", "is", null);

  if (jobsError) {
    return NextResponse.json({ error: "Failed to load jobs." }, { status: 500 });
  }

  if (!jobs?.length) {
    return NextResponse.json({ updated: 0 });
  }

  const { data: profileData, error: profileError } = await insforge.database
    .from("profiles")
    .select("current_title, years_experience, experience_level, skills, work_experience, personal_projects, spoken_languages, remote_preference, preferred_locations")
    .eq("id", user.id)
    .single();

  if (profileError || !profileData) {
    return NextResponse.json({ error: "Profile not found." }, { status: 404 });
  }

  const profile = profileData as Profile;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

  let updated = 0;
  let failed = 0;

  // Score sequentially to avoid hammering the OpenAI rate limit
  for (const job of jobs) {
    try {
      const scored = await scoreJob(
        {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location ?? null,
          description: job.about_role ?? "",
          url: "",
          salary: null,
          job_type: null,
          source: "url" as const,
        },
        profile,
        openai,
        "",  // use profile's remote_preference + preferred_locations, not job's location
      );

      if (!scored) { failed++; continue; }

      const { error } = await insforge.database
        .from("jobs")
        .update({
          matched_skills: scored.matchedSkills,
          missing_skills: scored.missingSkills,
          match_score: scored.matchScore,
          match_reason: scored.matchReason,
          experience_score: scored.experienceScore,
          seniority_score: scored.seniorityScore,
        })
        .eq("id", job.id)
        .eq("user_id", user.id);

      if (error) { failed++; } else { updated++; }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ updated, failed, total: jobs.length });
}
