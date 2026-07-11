"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function PaymentPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create session");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

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

        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-surface-secondary border border-border flex items-center justify-center">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-text-secondary">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>

          <h1 className="text-2xl font-semibold text-text-primary">Add credit to get started</h1>

          <p className="text-sm text-text-secondary leading-relaxed max-w-sm">
            Your account is approved. Add <span className="text-text-primary font-medium">$20 of AI credit</span> to
            start searching for jobs, generating cover letters, and tailoring resumes.
          </p>
        </div>

        <div className="w-full bg-surface border border-border rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">AI Credit</span>
            <span className="text-2xl font-bold text-text-primary">$20.00</span>
          </div>
          <ul className="flex flex-col gap-2 text-sm text-text-secondary text-left">
            {[
              "Job search & AI matching",
              "Cover letter generation",
              "Tailored resume creation",
              "Company research",
              "LinkedIn messages",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-success shrink-0">
                  <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {error && <p className="text-xs text-error">{error}</p>}

          <button
            onClick={handlePay}
            disabled={loading}
            className="w-full bg-accent text-white rounded-xl py-3 text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {loading ? "Redirecting to Stripe…" : "Pay $20 with Stripe"}
          </button>

          <p className="text-xs text-text-muted">
            Secure payment via Stripe. You can top up again when your credit runs out.
          </p>
        </div>
      </div>
    </main>
  );
}
