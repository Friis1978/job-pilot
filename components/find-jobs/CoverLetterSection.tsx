"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

type Props = {
  jobId: string;
  initialCoverLetter: string | null;
  hasAvatar: boolean;
};

export function CoverLetterSection({ jobId, initialCoverLetter, hasAvatar }: Props) {
  const [coverLetter, setCoverLetter] = useState(initialCoverLetter);
  const [generating, setGenerating] = useState(false);
  const [extraInstructions, setExtraInstructions] = useState("");
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [includePhoto, setIncludePhoto] = useState(true);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/agent/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, extraInstructions: extraInstructions.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        toast(json.error ?? "Generation failed. Please try again.");
        return;
      }
      // Fetch the updated cover letter
      const jobRes = await fetch(`/api/jobs/${jobId}/cover-letter-text`);
      if (jobRes.ok) {
        const { text } = await jobRes.json() as { text: string };
        setCoverLetter(text);
      } else {
        // Fallback: reload page to pick up DB change
        window.location.reload();
      }
    } catch {
      toast("Generation failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveEdit() {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText }),
      });
      if (!res.ok) {
        toast("Failed to save. Please try again.");
        return;
      }
      setCoverLetter(editText);
      setEditing(false);
    } catch {
      toast("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleStartEdit() {
    setEditText(coverLetter ?? "");
    setEditing(true);
  }

  function handleCancelEdit() {
    setEditing(false);
    setEditText("");
  }

  async function handleCopy() {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      const params = hasAvatar && !includePhoto ? "?photo=0" : "";
      const res = await fetch(`/api/jobs/${jobId}/cover-letter${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast((body as { error?: string }).error ?? "Download failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cover-letter.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast("Download failed. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border">
        <LetterIcon className="w-5 h-5 text-text-muted shrink-0" />
        <h2 className="flex-1 text-base font-semibold text-text-primary">Cover Letter</h2>

        {coverLetter && !editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              {copied ? (
                <><CheckIcon className="w-3.5 h-3.5 text-success" />Copied</>
              ) : (
                <><CopyIcon className="w-3.5 h-3.5" />Copy</>
              )}
            </button>
            <button
              onClick={handleStartEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <EditIcon className="w-3.5 h-3.5" />
              Edit
            </button>
            {hasAvatar && (
              <button
                onClick={() => setIncludePhoto((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${
                  includePhoto
                    ? "border-accent text-accent bg-accent/5 hover:bg-accent/10"
                    : "border-border text-text-muted hover:bg-surface-secondary"
                }`}
                title={includePhoto ? "Photo included in PDF" : "Photo excluded from PDF"}
              >
                <PhotoIcon className="w-3.5 h-3.5" />
                Photo
                {includePhoto && <CheckIcon className="w-3 h-3" />}
              </button>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <DownloadIcon className="w-3.5 h-3.5" />
              )}
              {downloading ? "Downloading..." : "Download PDF"}
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? (
                <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshIcon className="w-3.5 h-3.5" />
              )}
              {generating ? "Generating..." : "Regenerate"}
            </button>
          </div>
        )}

        {!coverLetter && !editing && (
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {generating ? (
              <SpinnerIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SparkleIcon className="w-4 h-4" />
            )}
            {generating ? "Generating..." : "Generate Cover Letter"}
          </button>
        )}

        {editing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleCancelEdit}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving && <SpinnerIcon className="w-3.5 h-3.5 animate-spin" />}
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Extra instructions */}
      {!editing && (
        <div className="px-4 py-3 border-b border-border bg-surface">
          <label className="block text-xs font-medium uppercase tracking-wide text-text-secondary mb-1.5">
            Extra instructions
          </label>
          <textarea
            value={extraInstructions}
            onChange={(e) => setExtraInstructions(e.target.value)}
            placeholder="e.g. emphasize Bandfolio, write in Danish, make it shorter"
            rows={2}
            className="w-full px-3 py-2 border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent bg-surface transition-colors resize-y"
          />
        </div>
      )}

      {/* Body */}
      <div className="bg-surface-secondary p-5">
        {editing ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full min-h-[400px] px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-y transition-colors font-[inherit]"
            autoFocus
          />
        ) : coverLetter ? (
          <div>
            <p className="text-sm text-text-primary leading-relaxed whitespace-pre-wrap">
              {coverLetter}
            </p>
            {!hasAvatar && (
              <p className="mt-4 text-xs text-text-muted">
                Tip: add a profile photo in{" "}
                <a href="/profile" className="text-accent hover:text-accent-dark transition-colors underline">
                  your Profile
                </a>{" "}
                to include it in the downloaded PDF.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <LetterIcon className="w-8 h-8 text-border" />
            <p className="text-sm font-medium text-text-primary">No cover letter yet</p>
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

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
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

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
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
