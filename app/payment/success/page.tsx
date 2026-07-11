"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "ready" | "error">("pending");

  useEffect(() => {
    let attempts = 0;

    async function activate() {
      const res = await fetch("/api/payment/activate", { method: "POST" });
      if (res.ok) {
        setStatus("ready");
        setTimeout(() => router.push("/dashboard"), 1500);
        return;
      }
      attempts++;
      if (attempts < 8) {
        // Webhook may still be processing — retry up to ~16s
        setTimeout(activate, 2000);
      } else {
        setStatus("error");
      }
    }

    activate();
  }, [router]);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center gap-8 text-center">
        <Link href="/">
          <Image
            src="/developerjobs-logo-horizontal.svg"
            alt="DeveloperJobs"
            width={160}
            height={40}
            className="h-8 w-auto"
          />
        </Link>

        {status === "pending" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-surface-secondary border border-border flex items-center justify-center">
              <svg className="animate-spin text-accent" width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="60" strokeDashoffset="20" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Confirming payment…</h1>
            <p className="text-sm text-text-secondary">Just a moment while we activate your credit.</p>
          </div>
        )}

        {status === "ready" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-success">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Payment successful</h1>
            <p className="text-sm text-text-secondary">$20 of AI credit added. Redirecting to dashboard…</p>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-2xl font-semibold text-text-primary">Payment received</h1>
            <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
              Your payment went through but activation is taking longer than expected.
              Try signing in again to refresh your access.
            </p>
            <Link
              href="/auth/login"
              className="w-full max-w-xs bg-accent text-white rounded-xl py-3 text-sm font-semibold hover:bg-accent/90 transition-colors text-center"
            >
              Sign in again
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
