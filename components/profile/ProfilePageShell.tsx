"use client";

import { useState } from "react";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { Profile, ProfileFormInput } from "@/types";

type Props = {
  profile: Profile | null;
  initialResumeUrl: string | null;
  userId: string | null;
};

export function ProfilePageShell({ profile, initialResumeUrl, userId }: Props) {
  const [extractedFormData, setExtractedFormData] =
    useState<Partial<ProfileFormInput> | null>(null);
  const [extractionCount, setExtractionCount] = useState(0);

  function handleExtract(data: Partial<ProfileFormInput>) {
    setExtractedFormData(data);
    setExtractionCount((n) => n + 1);
  }

  return (
    <>
      <ResumeUpload
        initialResumeUrl={initialResumeUrl}
        userId={userId}
        onExtract={handleExtract}
      />
      <ProfileForm
        key={extractionCount > 0 ? `extracted-${extractionCount}` : (profile?.updated_at ?? "empty")}
        initialData={profile}
        extractedFormData={extractionCount > 0 ? extractedFormData : null}
      />
    </>
  );
}
