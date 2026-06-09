import { Navbar } from "@/components/layout/Navbar";
import { CompletionIndicator } from "@/components/profile/CompletionIndicator";
import { ConnectedAccounts } from "@/components/profile/ConnectedAccounts";
import { ProfilePageShell } from "@/components/profile/ProfilePageShell";
import { createInsforgeServer } from "@/lib/insforge-server";
import type { Profile } from "@/types";

type RequiredKey =
  | "full_name"
  | "phone"
  | "location"
  | "current_title"
  | "experience_level"
  | "years_experience"
  | "skills"
  | "work_experience"
  | "education_degree"
  | "job_titles_seeking"
  | "remote_preference";

const MISSING_LABELS: Record<RequiredKey, string> = {
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

function computeCompletion(profile: Profile | null): {
  percentage: number;
  missingFields: string[];
} {
  if (!profile) {
    return {
      percentage: 0,
      missingFields: Object.values(MISSING_LABELS),
    };
  }

  const checks: Record<RequiredKey, boolean> = {
    full_name: !!profile.full_name,
    phone: !!profile.phone,
    location: !!profile.location,
    current_title: !!profile.current_title,
    experience_level: !!profile.experience_level,
    years_experience: !!profile.years_experience,
    skills: (profile.skills?.length ?? 0) > 0,
    work_experience: (profile.work_experience?.length ?? 0) > 0,
    education_degree: !!(profile.education as { degree?: string } | null)?.degree,
    job_titles_seeking: (profile.job_titles_seeking?.length ?? 0) > 0,
    remote_preference: !!profile.remote_preference,
  };

  const total = Object.keys(checks).length;
  const filled = Object.values(checks).filter(Boolean).length;
  const percentage = Math.round((filled / total) * 100);
  const missingFields = (Object.entries(checks) as [RequiredKey, boolean][])
    .filter(([, ok]) => !ok)
    .map(([key]) => MISSING_LABELS[key]);

  return { percentage, missingFields };
}

export default async function ProfilePage() {
  const insforge = await createInsforgeServer();
  const { data: authData } = await insforge.auth.getCurrentUser();
  const userId = authData?.user?.id;

  let profile: Profile | null = null;
  if (userId) {
    const { data } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    profile = (data as Profile) ?? null;
  }

  const { percentage, missingFields } = computeCompletion(profile);

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-6 pb-12">
          <CompletionIndicator percentage={percentage} missingFields={missingFields} />
          <ConnectedAccounts />
          <ProfilePageShell
            profile={profile}
            initialResumeUrl={profile?.resume_pdf_url ?? null}
            userId={userId ?? null}
          />
        </div>
      </main>
    </>
  );
}
