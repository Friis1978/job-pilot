"use client";

import { useState } from "react";
import type { Connection } from "@/types";
import type { LinkedInMessage as MessageType } from "@/agent/linkedin-message";

type Props = {
  contact: Connection;
  jobTitle: string;
  company: string;
};

export function LinkedInMessage({ contact, jobTitle, company }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MessageType | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/agent/linkedin-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: {
            first_name: contact.first_name,
            last_name: contact.last_name,
            position: contact.position,
            company: contact.company,
          },
          jobTitle,
          company,
        }),
      });
      const data = await res.json() as { success: boolean; result?: MessageType; error?: string };
      if (!data.success || !data.result) {
        setError(data.error ?? "Failed to generate message");
        return;
      }
      setResult(data.result);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-text-secondary">
          LinkedIn Message to {contact.first_name}
        </p>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="text-sm font-medium text-linkedin hover:underline disabled:opacity-50 transition-colors"
        >
          {loading ? "Generating…" : result ? "Regenerate" : "Generate"}
        </button>
      </div>

      {error && <p className="text-sm text-error">{error}</p>}

      {result && (
        <div className="space-y-3">
          <div className="bg-surface-secondary border border-border-light rounded-lg p-4">
            <p className="text-sm text-text-primary leading-relaxed">{result.message}</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {result.message.length} / 300 chars
            </span>
            <button
              onClick={handleCopy}
              className="text-xs font-medium text-accent hover:text-accent-dark transition-colors"
            >
              {copied ? "Copied!" : "Copy message"}
            </button>
          </div>
          {contact.linkedin_url && (
            <a
              href={contact.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-linkedin hover:underline"
            >
              Open LinkedIn profile
            </a>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <p className="text-sm text-text-muted">
          Generate a personalised connection request message for {contact.first_name} {contact.last_name}.
        </p>
      )}
    </div>
  );
}
