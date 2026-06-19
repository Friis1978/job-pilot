"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const STEPS = [
  {
    title: "Start by completing your profile",
    body: "Your profile is the foundation of everything — the AI uses it to score jobs, write cover letters, and tailor your resume to each role.",
    cta: "Head to Profile to add your experience, skills, and resume.",
    ctaHref: "/profile",
    imageSrc: "/images/onboarding-profile.png",
    imageAlt: "Job Pilot profile page",
    imageWidth: 1280,
    imageHeight: 860,
  },
  {
    title: "Search and discover jobs",
    body: "Enter a job title and location on the Find Jobs page. The AI searches multiple sources in parallel and scores every result against your profile.",
    cta: "Go to Find Jobs to run your first search.",
    ctaHref: "/find-jobs",
    imageSrc: "/images/onboarding-jobs.png",
    imageAlt: "Jobs list with match scores",
    imageWidth: 800,
    imageHeight: 560,
  },
];

export function OnboardingDialog({ show }: { show: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(show);

  if (!visible) return null;

  async function dismiss() {
    setVisible(false);
    fetch("/api/onboarding/mark-seen", { method: "POST" }).catch(() => {});
  }

  async function getStarted() {
    setVisible(false);
    fetch("/api/onboarding/mark-seen", { method: "POST" }).catch(() => {});
    router.push("/find-jobs");
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={dismiss}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-xl w-full max-w-xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-lg font-semibold text-text-primary">
              {step === 0 ? "Welcome to Job Pilot" : "Next up"}
            </h2>
          </div>
          <button
            onClick={dismiss}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M13.5 4.5L4.5 13.5M4.5 4.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-1.5 px-6 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <h3 className="text-base font-semibold text-text-primary mb-2">
            {current.title}
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            {current.body}
          </p>
        </div>

        {/* Screenshot */}
        <div className="mx-6 mt-4 rounded-lg overflow-hidden border border-border bg-surface-muted">
          <Image
            src={current.imageSrc}
            alt={current.imageAlt}
            width={current.imageWidth}
            height={current.imageHeight}
            className="w-full h-auto"
          />
        </div>

        {/* CTA hint */}
        <p className="px-6 mt-3 text-xs text-text-muted">
          {current.cta}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-5 mt-2">
          <button
            onClick={() => setStep((s) => s - 1)}
            className={`text-sm font-medium text-text-secondary hover:text-text-primary transition-colors ${
              step === 0 ? "invisible" : ""
            }`}
          >
            ← Back
          </button>
          {isLast ? (
            <button
              onClick={getStarted}
              className="px-4 py-2 text-sm font-medium bg-text-primary text-surface rounded-md hover:bg-text-darker transition-colors"
            >
              Get started →
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="px-4 py-2 text-sm font-medium bg-text-primary text-surface rounded-md hover:bg-text-darker transition-colors"
            >
              Next →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
