import { Navbar } from "@/components/layout/Navbar";
import { CompletionIndicator } from "@/components/profile/CompletionIndicator";
import { ConnectedAccounts } from "@/components/profile/ConnectedAccounts";
import { ResumeUpload } from "@/components/profile/ResumeUpload";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default function ProfilePage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-background py-8">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 flex flex-col gap-6 pb-12">
          <CompletionIndicator
            percentage={70}
            missingFields={["PHONE", "LOCATION", "EDUCATION"]}
          />
          <ConnectedAccounts />
          <ResumeUpload />
          <ProfileForm />
        </div>
      </main>
    </>
  );
}
