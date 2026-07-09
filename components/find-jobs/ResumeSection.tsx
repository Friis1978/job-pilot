"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

// ── Markdown preview (browser) ─────────────────────────────────────────────
type InlineToken = { kind: "text"; text: string } | { kind: "bold"; text: string } | { kind: "italic"; text: string } | { kind: "bold-italic"; text: string } | { kind: "link"; text: string; url: string };
const INLINE_RE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\s*\(([^)]+)\)/g;
function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = []; let last = 0; let m: RegExpExecArray | null; INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) tokens.push({ kind: "bold-italic", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: "bold", text: m[2] });
    else if (m[3] !== undefined) tokens.push({ kind: "italic", text: m[3] });
    else tokens.push({ kind: "link", text: m[4], url: m[5] });
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) tokens.push({ kind: "text", text: text.slice(last) });
  return tokens;
}
function renderInline(tokens: InlineToken[], keyBase: string) {
  return tokens.map((tok, i) => {
    const key = `${keyBase}-${i}`;
    if (tok.kind === "bold") return <strong key={key}>{tok.text}</strong>;
    if (tok.kind === "italic") return <em key={key}>{tok.text}</em>;
    if (tok.kind === "bold-italic") return <strong key={key}><em>{tok.text}</em></strong>;
    if (tok.kind === "link") return <a key={key} href={tok.url} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark">{tok.text}</a>;
    return <span key={key}>{tok.text}</span>;
  });
}
type Block = { kind: "h1" | "h2" | "h3"; tokens: InlineToken[] } | { kind: "paragraph"; tokens: InlineToken[] } | { kind: "bullet"; items: InlineToken[][] };
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)) {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    if (lines[0].startsWith("### ")) { blocks.push({ kind: "h3", tokens: parseInline(lines[0].slice(4)) }); if (lines.length > 1) blocks.push({ kind: "paragraph", tokens: parseInline(lines.slice(1).join(" ")) }); continue; }
    if (lines[0].startsWith("## "))  { blocks.push({ kind: "h2", tokens: parseInline(lines[0].slice(3)) }); if (lines.length > 1) blocks.push({ kind: "paragraph", tokens: parseInline(lines.slice(1).join(" ")) }); continue; }
    if (lines[0].startsWith("# "))   { blocks.push({ kind: "h1", tokens: parseInline(lines[0].slice(2)) }); if (lines.length > 1) blocks.push({ kind: "paragraph", tokens: parseInline(lines.slice(1).join(" ")) }); continue; }
    const isBullet = (l: string) => l.startsWith("- ") || l.startsWith("* ");
    if (lines.every(isBullet)) { blocks.push({ kind: "bullet", items: lines.map((l) => parseInline(l.replace(/^[-*] /, ""))) }); continue; }
    if (lines.some(isBullet)) {
      let paraAcc: string[] = [], bulletAcc: string[] = [];
      const flush = () => { if (paraAcc.length) { blocks.push({ kind: "paragraph", tokens: parseInline(paraAcc.join(" ")) }); paraAcc = []; } if (bulletAcc.length) { blocks.push({ kind: "bullet", items: bulletAcc.map((l) => parseInline(l.replace(/^[-*] /, ""))) }); bulletAcc = []; } };
      for (const line of lines) { if (isBullet(line)) { if (paraAcc.length) flush(); bulletAcc.push(line); } else { if (bulletAcc.length) flush(); paraAcc.push(line); } }
      flush(); continue;
    }
    blocks.push({ kind: "paragraph", tokens: parseInline(lines.join(" ")) });
  }
  return blocks;
}
function MarkdownPreview({ text, className }: { text: string; className?: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.kind === "h1") return <h1 key={i} className="text-base font-bold text-text-primary mt-3 mb-1 first:mt-0">{renderInline(block.tokens, `h1-${i}`)}</h1>;
        if (block.kind === "h2") return <h2 key={i} className="text-sm font-bold text-text-primary mt-3 mb-1 first:mt-0">{renderInline(block.tokens, `h2-${i}`)}</h2>;
        if (block.kind === "h3") return <h3 key={i} className="text-sm font-semibold text-text-primary mt-2.5 mb-0.5 first:mt-0">{renderInline(block.tokens, `h3-${i}`)}</h3>;
        if (block.kind === "bullet") return <ul key={i} className="my-1 flex flex-col gap-0.5 pl-4">{block.items.map((item, j) => <li key={j} className="text-sm text-text-primary leading-relaxed list-disc">{renderInline(item, `li-${i}-${j}`)}</li>)}</ul>;
        return <p key={i} className="text-sm text-text-primary leading-relaxed mb-2 last:mb-0">{renderInline(block.tokens, `p-${i}`)}</p>;
      })}
    </div>
  );
}

type Props = {
  jobId: string;
  hasResearch: boolean;
  initialMotivation: string | null;
  initialResumeText: string | null;
  hasGeneratedResume: boolean;
  avatarUrl?: string | null;
};

export function ResumeSection({ jobId, hasResearch, initialMotivation, initialResumeText, hasGeneratedResume, avatarUrl }: Props) {
  const [motivation, setMotivation] = useState(initialMotivation ?? "");
  const [resumeText, setResumeText] = useState(initialResumeText ?? "");
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingMotivation, setLoadingMotivation] = useState(false);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resumeReady, setResumeReady] = useState(hasGeneratedResume);
  const [includePhoto, setIncludePhoto] = useState(true);
  const hasAvatar = !!avatarUrl;

  const isDirty =
    motivation !== (initialMotivation ?? "") ||
    resumeText !== (initialResumeText ?? "");

  async function handleGenerateMotivation() {
    setLoadingMotivation(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/resume-motivation`, { method: "POST" });
      const json = await res.json() as { text?: string; error?: string };
      if (!res.ok || json.error) { toast(json.error ?? "Failed to generate motivation.", "error"); return; }
      setMotivation(json.text ?? "");
      setSaved(false);
    } catch {
      toast("Failed to generate motivation.", "error");
    } finally {
      setLoadingMotivation(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailored-resume`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivation, resumeText }),
      });
      if (!res.ok) { toast("Failed to save.", "error"); return; }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast("Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateResume() {
    setLoadingGenerate(true);
    try {
      // Save current motivation before generating
      if (motivation) {
        await fetch(`/api/jobs/${jobId}/tailored-resume`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivation }),
        });
      }
      const res = await fetch(`/api/jobs/${jobId}/tailored-resume`, { method: "POST" });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || json.error) { toast(json.error ?? "Failed to generate resume.", "error"); return; }
      // Fetch the generated text to populate the textarea
      const textRes = await fetch(`/api/jobs/${jobId}/tailored-resume/text`);
      if (textRes.ok) {
        const { resumeText: newText } = await textRes.json() as { resumeText?: string };
        if (newText) setResumeText(newText);
      }
      setResumeReady(true);
      toast("Resume generated.", "success");
    } catch {
      toast("Failed to generate resume.", "error");
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      // Save any pending changes first
      if (isDirty) {
        await fetch(`/api/jobs/${jobId}/tailored-resume`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ motivation, resumeText }),
        });
      }
      const photoParam = hasAvatar && !includePhoto ? "?photo=0" : "";
      const res = await fetch(`/api/jobs/${jobId}/tailored-resume${photoParam}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        toast(json.error ?? "Failed to download resume.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      toast("Failed to download resume.", "error");
    } finally {
      setDownloading(false);
    }
  }

  const combinedText = [motivation, resumeText].filter(Boolean).join("\n\n---\n\n");

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-4 border-b border-border">
        <DocumentIcon className="w-5 h-5 text-text-muted shrink-0" />
        <h2 className="flex-1 text-base font-semibold text-text-primary">Tailored Resume</h2>

        <button
          onClick={handleGenerateMotivation}
          disabled={loadingMotivation}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingMotivation ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <SparkleIcon className="w-3.5 h-3.5" />}
          {loadingMotivation ? "Generating..." : "Motivation"}
        </button>

        <button
          onClick={handleGenerateResume}
          disabled={loadingGenerate}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingGenerate ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <RefreshIcon className="w-3.5 h-3.5" />}
          {loadingGenerate ? "Generating..." : "Tailored Resume"}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3 border-b border-border bg-surface-secondary">
        <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs font-medium">
          <button
            onClick={() => setPreviewMode(false)}
            className={`px-3 py-1.5 transition-colors ${!previewMode ? "bg-surface text-text-primary" : "text-text-muted hover:bg-surface"}`}
          >
            Write
          </button>
          <button
            onClick={() => setPreviewMode(true)}
            className={`px-3 py-1.5 transition-colors ${previewMode ? "bg-surface text-text-primary" : "text-text-muted hover:bg-surface"}`}
          >
            Preview
          </button>
        </div>

        <div className="flex-1" />

        <button
          onClick={handleSave}
          disabled={saving || (!isDirty && !saved)}
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            saved ? "border-success/30 bg-success/5 text-success" : "border-border text-text-secondary hover:bg-surface"
          }`}
        >
          {saving ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckIcon className="w-3.5 h-3.5" /> : <SaveIcon className="w-3.5 h-3.5" />}
          {saving ? "Saving..." : saved ? "Saved" : "Save"}
        </button>

        {hasAvatar && resumeReady && (
          <button
            onClick={() => setIncludePhoto((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${includePhoto ? "border-accent text-accent bg-accent/5 hover:bg-accent/10" : "border-border text-text-muted hover:bg-surface-secondary"}`}
            title={includePhoto ? "Photo included in PDF" : "Photo excluded from PDF"}
          >
            <PhotoIcon className="w-3.5 h-3.5" />Photo
            {includePhoto && <CheckIcon className="w-3 h-3" />}
          </button>
        )}

        <button
          onClick={handleDownload}
          disabled={downloading || !resumeReady}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title={!resumeReady ? "Generate a tailored resume first" : undefined}
        >
          {downloading ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <DownloadIcon className="w-3.5 h-3.5" />}
          {downloading ? "Downloading..." : "Download PDF"}
        </button>
      </div>

      {/* Body */}
      <div className="bg-surface-secondary p-5 flex flex-col gap-4">
        {previewMode ? (
          combinedText.trim() ? (
            <div className="bg-surface border border-border rounded-xl px-5 py-4 min-h-[260px]">
              <MarkdownPreview text={combinedText} className="leading-relaxed" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-2 min-h-[260px]">
              <DocumentIcon className="w-8 h-8 text-border" />
              <p className="text-sm text-text-muted">Nothing yet — generate a tailored resume first.</p>
            </div>
          )
        ) : (
          <>
            {/* Motivation textarea */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Motivation</label>
              <textarea
                value={motivation}
                onChange={(e) => { setMotivation(e.target.value); setSaved(false); }}
                placeholder="Write why you're motivated to apply for this role, or click 'Motivation' to generate."
                rows={6}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary leading-relaxed placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-y transition-colors"
              />
            </div>

            {/* Resume content textarea */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Resume Content</label>
              <textarea
                value={resumeText}
                onChange={(e) => { setResumeText(e.target.value); setSaved(false); }}
                placeholder="Click 'Tailored Resume' above to generate resume content, then edit it here."
                rows={18}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary leading-relaxed placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-y transition-colors"
              />
              <p className="text-xs text-text-muted">
                Supports markdown: <code className="bg-surface-tertiary px-1 rounded text-[11px]">**bold**</code>{" "}
                <code className="bg-surface-tertiary px-1 rounded text-[11px]">*italic*</code>{" "}
                <code className="bg-surface-tertiary px-1 rounded text-[11px]">[text](url)</code>
              </p>
            </div>
          </>
        )}

        {!hasResearch && (
          <p className="text-xs text-text-muted">
            Tip: run Company Research first for a more targeted resume.
          </p>
        )}
      </div>
    </div>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.25c-.28 3.48-1.35 6.3-3.31 8.19C6.74 12.36 4.01 13.72 0 14c4.01.28 6.74 1.64 8.69 3.56C10.65 19.45 11.72 22.27 12 25.75c.28-3.48 1.35-6.3 3.31-8.19C17.26 15.64 19.99 14.28 24 14c-4.01-.28-6.74-1.64-8.69-3.56C13.35 8.55 12.28 5.73 12 2.25z" />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
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

function SaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3.5 3.5L13 5" />
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

function PhotoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}
