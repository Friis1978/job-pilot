"use server";

import { revalidatePath } from "next/cache";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { ProfileFormInput } from "@/types";

const REQUIRED_FIELDS = [
  "full_name",
  "phone",
  "location",
  "current_title",
  "experience_level",
  "years_experience",
  "skills",
  "work_experience",
  "education_degree",
  "job_titles_seeking",
  "remote_preference",
] as const;

const MISSING_FIELD_LABELS: Record<(typeof REQUIRED_FIELDS)[number], string> = {
  full_name: "NAME",
  phone: "PHONE",
  location: "LOCATION",
  current_title: "JOB TITLE",
  experience_level: "EXPERIENCE",
  years_experience: "YEARS EXP",
  skills: "SKILLS",
  work_experience: "WORK EXP",
  education_degree: "EDUCATION",
  job_titles_seeking: "JOB TITLES",
  remote_preference: "REMOTE PREF",
};

function splitToArray(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveProfile(
  input: ProfileFormInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const insforge = await createInsforgeServer();
    const { data, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !data?.user) {
      return { success: false, error: "Not authenticated" };
    }
    const userId = data.user.id;

    const education = {
      degree: input.highestDegree,
      field: input.fieldOfStudy,
      institution: input.institution,
      year: input.graduationYear,
    };

    const workExperience = input.workExperience.map(
      ({ id: _id, ...rest }) => rest,
    );

    const jobTitlesSeeking = splitToArray(input.jobTitlesSeeking);
    const preferredLocations = splitToArray(input.preferredLocations);
    const yearsExperience = parseInt(input.yearsExperience, 10) || 0;

    const mapped = {
      full_name: input.fullName || null,
      email: input.email || null,
      phone: input.phone || null,
      location: input.location || null,
      current_title: input.currentTitle || null,
      experience_level: input.experienceLevel || null,
      years_experience: yearsExperience || null,
      skills: input.skills.length > 0 ? input.skills : null,
      industries: input.industries.length > 0 ? input.industries : null,
      work_experience: workExperience.length > 0 ? workExperience : null,
      education: education.degree ? education : null,
      job_titles_seeking: jobTitlesSeeking.length > 0 ? jobTitlesSeeking : null,
      remote_preference: input.remotePreference || null,
      preferred_locations: preferredLocations.length > 0 ? preferredLocations : null,
      salary_expectation: input.salaryExpectation || null,
      cover_letter_tone: input.coverLetterTone || null,
      linkedin_url: input.linkedinUrl || null,
      portfolio_url: input.portfolioUrl || null,
      work_authorization: input.workAuthorization || null,
    };

    const checks = {
      full_name: !!mapped.full_name,
      phone: !!mapped.phone,
      location: !!mapped.location,
      current_title: !!mapped.current_title,
      experience_level: !!mapped.experience_level,
      years_experience: !!mapped.years_experience,
      skills: !!mapped.skills,
      work_experience: !!mapped.work_experience,
      education_degree: !!mapped.education,
      job_titles_seeking: !!mapped.job_titles_seeking,
      remote_preference: !!mapped.remote_preference,
    };

    const is_complete = Object.values(checks).every(Boolean);

    // Check if row exists (trigger backfill may have missed pre-existing users)
    const { data: existing } = await insforge.database
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    let dbError;
    if (existing) {
      ({ error: dbError } = await insforge.database
        .from("profiles")
        .update({ ...mapped, is_complete })
        .eq("id", userId));
    } else {
      ({ error: dbError } = await insforge.database
        .from("profiles")
        .insert([{ id: userId, ...mapped, is_complete }]));
    }

    if (dbError) {
      console.error("[actions/profile] saveProfile db error", dbError);
      return { success: false, error: "Failed to save profile" };
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("[actions/profile] saveProfile", error);
    return { success: false, error: "Failed to save profile" };
  }
}

export async function updateAvatarUrl(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const insforge = await createInsforgeServer();
    const { data, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !data?.user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error: dbError } = await insforge.database
      .from("profiles")
      .update({ avatar_url: url })
      .eq("id", data.user.id);

    if (dbError) {
      console.error("[actions/profile] updateAvatarUrl db error", dbError);
      return { success: false, error: "Failed to save avatar URL" };
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("[actions/profile] updateAvatarUrl", error);
    return { success: false, error: "Failed to save avatar URL" };
  }
}

export async function updateResumeUrl(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const insforge = await createInsforgeServer();
    const { data, error: authError } = await insforge.auth.getCurrentUser();
    if (authError || !data?.user) {
      return { success: false, error: "Not authenticated" };
    }

    const { error: dbError } = await insforge.database
      .from("profiles")
      .update({ resume_pdf_url: url })
      .eq("id", data.user.id);

    if (dbError) {
      console.error("[actions/profile] updateResumeUrl db error", dbError);
      return { success: false, error: "Failed to save resume URL" };
    }

    revalidatePath("/profile");
    return { success: true };
  } catch (error) {
    console.error("[actions/profile] updateResumeUrl", error);
    return { success: false, error: "Failed to save resume URL" };
  }
}
