"use client";

import { useState } from "react";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { ProfileForm } from "@/components/profile/ProfileForm";
import type { Profile, ProfileFormInput } from "@/types";

type Props = {
  profile: Profile | null;
  userId: string | null;
};

export function ProfilePageShell({ profile, userId }: Props) {
  const [extractedFormData, setExtractedFormData] =
    useState<Partial<ProfileFormInput> | null>(null);
  const [extractionCount, setExtractionCount] = useState(0);

  function handleExtract(data: Partial<ProfileFormInput>) {
    setExtractedFormData(data);
    setExtractionCount((n) => n + 1);
  }

  const resumeUpload = (
    <ResumeUpload
      userId={userId}
      onExtract={handleExtract}
      embedded={!!profile}
    />
  );

  if (!profile) {
    return (
      <>
        {resumeUpload}
        <ProfileForm
          key={extractionCount > 0 ? `extracted-${extractionCount}` : "empty"}
          initialData={null}
          extractedFormData={extractionCount > 0 ? extractedFormData : null}
          userId={userId}
        />
      </>
    );
  }

  return (
    <ProfileForm
      key={extractionCount > 0 ? `extracted-${extractionCount}` : (profile.updated_at ?? "profile")}
      initialData={profile}
      extractedFormData={extractionCount > 0 ? extractedFormData : null}
      userId={userId}
      resumeSection={resumeUpload}
    />
  );
}
