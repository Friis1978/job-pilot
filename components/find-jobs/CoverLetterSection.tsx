"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

type Props = { jobId: string; initialCoverLetter: string | null };

export function CoverLetterSection({ jobId, initialCoverLetter }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast(json.error ?? "Generation failed. Please try again.");
        return;
      }
      router.refresh();
    } catch {
      toast("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!initialCoverLetter) return;
    await navigator.clipboard.writeText(initialCoverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <LetterIcon className="w-5 h-5 text-text-muted shrink-0" />
        <h2 className="flex-1 text-base font-semibold text-text-primary">
          Cover Letter
        </h2>
        {initialCoverLetter ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              {copied ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-success" />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon className="w-3.5 h-3.5" />
                  Copy
                </>
              )}
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshIcon className="w-3.5 h-3.5" />
              )}
              {loading ? "Generating..." : "Regenerate"}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SparkleIcon className="w-4 h-4" />
            )}
            {loading ? "Generating..." : "Generate Cover Letter"}
          </button>
        )}
      </div>

      {/* Body */}
      <div className="bg-surface-secondary p-5">
        {initialCoverLetter ? (
          <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
            {initialCoverLetter}
          </p>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <LetterIcon className="w-8 h-8 text-border" />
            </div>
            <p className="text-sm font-medium text-text-primary">
              No cover letter yet
            </p>
            <p className="text-sm text-text-muted text-center max-w-xs">
              Click &ldquo;Generate Cover Letter&rdquo; to create a personalised letter tailored to this role.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function LetterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4zM4 8l8 5 8-5" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.25c-.28 3.48-1.35 6.3-3.31 8.19C6.74 12.36 4.01 13.72 0 14c4.01.28 6.74 1.64 8.69 3.56C10.65 19.45 11.72 22.27 12 25.75c.28-3.48 1.35-6.3 3.31-8.19C17.26 15.64 19.99 14.28 24 14c-4.01-.28-6.74-1.64-8.69-3.56C13.35 8.55 12.28 5.73 12 2.25z" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
