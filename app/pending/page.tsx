import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createInsforgeServer } from "@/lib/insforge-server";
import { LogoutButton } from "./LogoutButton";

export default async function PendingPage() {
  const insforge = await createInsforgeServer();
  const { data: authData } = await insforge.auth.getCurrentUser();

  if (!authData?.user) {
    redirect("/");
  }

  const email = authData.user.email ?? null;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center gap-8 text-center">
        <Link href="/">
          <Image
            src="/jobpilot-logo-horizontal.svg"
            alt="JobPilot"
            width={160}
            height={40}
            className="h-8 w-auto"
          />
        </Link>

        <div className="flex flex-col items-center gap-3">
          {/* Clock icon */}
          <div className="w-14 h-14 rounded-full bg-surface-secondary border border-border flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-text-secondary">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
              <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-text-primary">
            Account pending approval
          </h1>

          <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
            Thanks for signing up. Your account is being reviewed by an admin.
            {email && (
              <>
                {" "}You'll receive a confirmation at{" "}
                <span className="text-text-primary font-medium">{email}</span>{" "}
                as soon as you're approved.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-xs text-text-muted">
            Already been approved?
          </p>
          <Link
            href="/auth/login"
            className="w-full max-w-xs text-center text-sm font-medium text-accent hover:text-accent/80 transition-colors underline underline-offset-4"
          >
            Sign in again to refresh your access
          </Link>
        </div>

        <LogoutButton />
      </div>
    </main>
  );
}
