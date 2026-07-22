"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "@/lib/toast";

type Props = {
  jobId: string;
  initialCoverLetter: string | null;
  initialHumanizedLetter: string | null;
  hasAvatar: boolean;
  tailoredSummary?: string | null;
};

// ── Simple markdown renderer for browser preview ───────────────────────────

type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "bold"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "bold-italic"; text: string }
  | { kind: "link"; text: string; url: string };

const INLINE_RE = /\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|\[(.+?)\]\s*\(([^)]+)\)/g;

function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined)      tokens.push({ kind: "bold-italic", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ kind: "bold", text: m[2] });
    else if (m[3] !== undefined) tokens.push({ kind: "italic", text: m[3] });
    else                         tokens.push({ kind: "link", text: m[4], url: m[5] });
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
    if (tok.kind === "link")
      return <a key={key} href={tok.url} target="_blank" rel="noopener noreferrer" className="text-accent underline hover:text-accent-dark transition-colors">{tok.text}</a>;
    return <span key={key}>{tok.text}</span>;
  });
}

type Block =
  | { kind: "h1" | "h2" | "h3"; tokens: InlineToken[] }
  | { kind: "paragraph"; tokens: InlineToken[] }
  | { kind: "bullet"; items: InlineToken[][] };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const rawBlocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  for (const raw of rawBlocks) {
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
      flush();
      continue;
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
        if (block.kind === "bullet")
          return (
            <ul key={i} className="my-1 flex flex-col gap-0.5 pl-4">
              {block.items.map((item, j) => (
                <li key={j} className="text-sm text-text-primary leading-relaxed list-disc">{renderInline(item, `li-${i}-${j}`)}</li>
              ))}
            </ul>
          );
        return <p key={i} className="text-sm text-text-primary leading-relaxed mb-2 last:mb-0">{renderInline(block.tokens, `p-${i}`)}</p>;
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function CoverLetterSection({ jobId, initialCoverLetter, initialHumanizedLetter, hasAvatar, tailoredSummary }: Props) {
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [letterStyle, setLetterStyle] = useState<"compact" | "detailed">("compact");

  const [coverLetter, setCoverLetter] = useState(initialCoverLetter ?? "");
  const [previewMode, setPreviewMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [includePhoto, setIncludePhoto] = useState(true);
  const [includeResume, setIncludeResume] = useState(false);
  const [includeJobTitle, setIncludeJobTitle] = useState(true);

  const [styleAdvice, setStyleAdvice] = useState(initialHumanizedLetter ?? "");
  const [adviceSaving, setAdviceSaving] = useState(false);
  const [adviceSaved, setAdviceSaved] = useState(false);
  const [geminiCopied, setGeminiCopied] = useState(false);
  const [loadingRewrite, setLoadingRewrite] = useState(false);
  const [saplingFeedback, setSaplingFeedback] = useState<{ score: number | null; action: string; flaggedSentences: number; sentenceScores?: { sentence: string; score: number }[] } | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (optionsRef.current && !optionsRef.current.contains(e.target as Node)) {
        setOptionsOpen(false);
      }
    }
    if (optionsOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [optionsOpen]);

  const isDirty = coverLetter !== (initialCoverLetter ?? "");

  async function handleGenerateCoverLetter() {
    setLoadingGenerate(true);
    try {
      const res = await fetch("/api/agent/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, style: letterStyle }),
      });
      const json = await res.json() as { success?: boolean; text?: string; error?: string; saplingFeedback?: { score: number | null; action: string; flaggedSentences: number; sentenceScores?: { sentence: string; score: number }[] } };
      if (!res.ok || json.error) { toast(json.error ?? "Failed to generate cover letter. Please try again.", "error"); return; }
      setCoverLetter(json.text ?? "");
      setSaplingFeedback(json.saplingFeedback ?? null);
      toast("Cover letter generated!", "success");
    } catch {
      toast("Failed to generate cover letter. Please try again.", "error");
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function handleRewriteWithAdvice() {
    if (!styleAdvice.trim()) return;
    setLoadingRewrite(true);
    try {
      // Save advice first so it persists
      await fetch(`/api/jobs/${jobId}/humanized-cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: styleAdvice }),
      });
      const res = await fetch("/api/agent/cover-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, style: letterStyle, extraInstructions: styleAdvice }),
      });
      const json = await res.json() as { success?: boolean; text?: string; error?: string };
      if (!res.ok || json.error) { toast(json.error ?? "Failed to rewrite. Please try again.", "error"); return; }
      setCoverLetter(json.text ?? "");
      toast("Letter rewritten with your advice!", "success");
    } catch {
      toast("Failed to rewrite. Please try again.", "error");
    } finally {
      setLoadingRewrite(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/jobs/${jobId}/cover-letter`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: coverLetter }),
      });
      if (!res.ok) { toast("Failed to save. Please try again.", "error"); return; }
      setSaved(true);
      toast("Cover letter saved.", "success");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast("Failed to save. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyAndOpenGemini() {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
    setGeminiCopied(true);
    setTimeout(() => setGeminiCopied(false), 2000);
    window.open("https://gemini.google.com/", "_blank", "noopener,noreferrer");
  }

  async function handleSaveAdvice() {
    if (!styleAdvice.trim()) return;
    setAdviceSaving(true);
    setAdviceSaved(false);
    try {
      const res = await fetch(`/api/jobs/${jobId}/humanized-cover-letter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: styleAdvice }),
      });
      if (!res.ok) { toast("Failed to save advice.", "error"); return; }
      setAdviceSaved(true);
      toast("Advice saved.", "success");
      setTimeout(() => setAdviceSaved(false), 3000);
    } catch {
      toast("Failed to save advice.", "error");
    } finally {
      setAdviceSaving(false);
    }
  }

  async function handleDownload() {
    if (!coverLetter.trim()) { toast("Write your cover letter before downloading.", "error"); return; }
    setDownloading(true);
    try {
      const searchParams = new URLSearchParams();
      if (hasAvatar && !includePhoto) searchParams.set("photo", "0");
      if (tailoredSummary && includeResume) searchParams.set("resume", "1");
      if (!includeJobTitle) searchParams.set("title", "0");
      const params = searchParams.toString() ? `?${searchParams.toString()}` : "";
      const res = await fetch(`/api/jobs/${jobId}/cover-letter${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: coverLetter }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast((body as { error?: string }).error ?? "Download failed. Please try again.", "error");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "cover-letter.pdf";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch {
      toast("Download failed. Please try again.", "error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden">

      {/* ── Cover letter editor ────────────────────────────────────── */}
      <div>
        {/* Title row */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
          <LetterIcon className="w-4 h-4 text-text-muted shrink-0" />
          <h2 className="text-sm font-semibold text-text-primary">Your Cover Letter</h2>
        </div>

        {/* Toolbar row */}
        <div className="flex items-center gap-1.5 flex-wrap px-6 py-3 border-b border-border">
          <button
            onClick={handleGenerateCoverLetter}
            disabled={loadingGenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-accent/20 bg-accent/5 rounded-lg text-xs font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingGenerate ? (
              <><SpinnerIcon className="w-3.5 h-3.5 animate-spin" />Writing...</>
            ) : (
              <><SparkleIcon className="w-3.5 h-3.5" />Generate</>
            )}
          </button>

          {styleAdvice.trim() && (
            <div className="relative group">
              <button
                onClick={handleRewriteWithAdvice}
                disabled={loadingRewrite}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-orange-400/30 bg-orange-400/5 rounded-lg text-xs font-medium text-orange-500 hover:bg-orange-400/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingRewrite ? (
                  <><SpinnerIcon className="w-3.5 h-3.5 animate-spin" />Rewriting...</>
                ) : (
                  <><WandIcon className="w-3.5 h-3.5" />Recreate with advice</>
                )}
              </button>
              <div className="absolute left-0 top-full mt-1.5 w-64 z-20 hidden group-hover:block">
                <div className="bg-surface border border-border rounded-xl shadow-lg px-3 py-2.5 text-xs text-text-secondary leading-relaxed">
                  <p className="font-semibold text-text-primary mb-1">How this works</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Copy your letter and paste it into Gemini.</li>
                    <li>Ask it to review or suggest improvements — copy those suggestions.</li>
                    <li>Paste the suggestions into the advice box below.</li>
                    <li>Click <strong>Recreate with advice</strong> to generate a new version that follows them.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {coverLetter && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              {copied ? <><CheckIcon className="w-3.5 h-3.5 text-success" />Copied</> : <><CopyIcon className="w-3.5 h-3.5" />Copy</>}
            </button>
          )}

          {/* PDF options dropdown */}
          <div className="relative" ref={optionsRef}>
            <button
              onClick={() => setOptionsOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors ${optionsOpen ? "border-accent/30 bg-accent/5 text-accent" : "border-border text-text-secondary hover:bg-surface-secondary"}`}
            >
              <GearIcon className="w-3.5 h-3.5" />PDF options
              <ChevronIcon className={`w-3 h-3 transition-transform ${optionsOpen ? "rotate-180" : ""}`} />
            </button>
            {optionsOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-52 z-20 bg-surface border border-border rounded-xl shadow-lg py-2">
                <div className="px-3 py-2 flex items-center justify-between gap-3">
                  <span className="text-xs text-text-secondary">Style</span>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs font-medium">
                    <button
                      onClick={() => setLetterStyle("compact")}
                      className={`px-2.5 py-1 transition-colors ${letterStyle === "compact" ? "bg-surface-secondary text-text-primary" : "text-text-muted hover:bg-surface-secondary"}`}
                    >
                      Compact
                    </button>
                    <button
                      onClick={() => setLetterStyle("detailed")}
                      className={`px-2.5 py-1 transition-colors ${letterStyle === "detailed" ? "bg-surface-secondary text-text-primary" : "text-text-muted hover:bg-surface-secondary"}`}
                    >
                      Detailed
                    </button>
                  </div>
                </div>
                <div className="h-px bg-border mx-3 my-1" />
                {hasAvatar && (
                  <button
                    onClick={() => setIncludePhoto((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary hover:bg-surface-secondary transition-colors"
                  >
                    <span className="flex items-center gap-2"><PhotoIcon className="w-3.5 h-3.5" />Include photo</span>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${includePhoto ? "bg-accent border-accent" : "border-border"}`}>
                      {includePhoto && <CheckIcon className="w-2.5 h-2.5 text-accent-foreground" />}
                    </span>
                  </button>
                )}
                <button
                  onClick={() => setIncludeJobTitle((v) => !v)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary hover:bg-surface-secondary transition-colors"
                >
                  <span className="flex items-center gap-2"><LetterIcon className="w-3.5 h-3.5" />Show job title</span>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center ${includeJobTitle ? "bg-accent border-accent" : "border-border"}`}>
                    {includeJobTitle && <CheckIcon className="w-2.5 h-2.5 text-accent-foreground" />}
                  </span>
                </button>
                {tailoredSummary && (
                  <button
                    onClick={() => setIncludeResume((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-text-secondary hover:bg-surface-secondary transition-colors"
                  >
                    <span className="flex items-center gap-2"><SummaryIcon className="w-3.5 h-3.5" />Append resume</span>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center ${includeResume ? "bg-accent border-accent" : "border-border"}`}>
                      {includeResume && <CheckIcon className="w-2.5 h-2.5 text-accent-foreground" />}
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex-1" />

          <button
            onClick={handleSave}
            disabled={saving || (!isDirty && !saved)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              saved ? "border-success/30 bg-success/5 text-success" : "border-border text-text-secondary hover:bg-surface-secondary"
            }`}
          >
            {saving ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckIcon className="w-3.5 h-3.5" /> : <SaveIcon className="w-3.5 h-3.5" />}
            {saving ? "Saving..." : saved ? "Saved" : "Save"}
          </button>

          <button
            onClick={handleDownload}
            disabled={downloading || !coverLetter.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-accent-foreground rounded-lg text-xs font-medium hover:bg-accent-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading ? <SpinnerIcon className="w-3.5 h-3.5 animate-spin" /> : <DownloadIcon className="w-3.5 h-3.5" />}
            {downloading ? "Downloading..." : "Download PDF"}
          </button>
        </div>

        {/* ── Intro tip ───────────────────────────────────────────── */}
        <div className="px-6 py-3 border-b border-border bg-surface-secondary/50">
          <div className="flex gap-2.5">
            <SparkleIcon className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
            <p className="text-xs text-text-secondary leading-relaxed">
              <strong className="text-text-primary">Tip:</strong> After generating, read through carefully and rewrite any sentence that sounds stiff or too polished. Use <strong className="text-text-primary">Get advice &amp; rewrite</strong> below — copy your letter into Gemini, ask it to flag AI-sounding phrases, paste its suggestions back, then click <strong className="text-text-primary">Recreate with advice</strong>.
            </p>
          </div>
        </div>

        {/* Editor body */}
        <div className="bg-surface-secondary p-5">
          {/* Write / Preview toggle */}
          <div className="flex justify-start mb-3">
            <div className="flex items-center border border-border rounded-lg overflow-hidden text-xs font-medium">
              <button
                onClick={() => setPreviewMode(false)}
                className={`px-3 py-1.5 transition-colors ${!previewMode ? "bg-surface text-text-primary" : "text-text-secondary hover:bg-surface"}`}
              >
                Write
              </button>
              <button
                onClick={() => setPreviewMode(true)}
                className={`px-3 py-1.5 transition-colors ${previewMode ? "bg-surface text-text-primary" : "text-text-secondary hover:bg-surface"}`}
              >
                Preview
              </button>
            </div>
          </div>
          {previewMode ? (
            coverLetter.trim() ? (
              <div className="bg-surface border border-border rounded-xl px-5 py-4 min-h-[320px]">
                <MarkdownPreview text={coverLetter} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-2 min-h-[320px]">
                <LetterIcon className="w-8 h-8 text-border" />
                <p className="text-sm text-text-muted">Nothing to preview yet — switch to Write and start typing.</p>
              </div>
            )
          ) : (
            <div className="flex flex-col gap-2">
              <textarea
                value={coverLetter}
                onChange={(e) => { setCoverLetter(e.target.value); setSaved(false); }}
                placeholder={"Write your cover letter here...\n\nYou can use markdown formatting:\n**bold**, *italic*, [link text](https://url.com)"}
                rows={18}
                className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary leading-relaxed placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-y transition-colors"
              />
              <p className="text-xs text-text-muted">
                Supports markdown: <code className="bg-surface-tertiary px-1 rounded text-[11px]">**bold**</code>{" "}
                <code className="bg-surface-tertiary px-1 rounded text-[11px]">*italic*</code>{" "}
                <code className="bg-surface-tertiary px-1 rounded text-[11px]">[text](url)</code>
              </p>
            </div>
          )}

          {saplingFeedback && (
            <div className="mt-3 px-3 py-2.5 bg-surface-secondary border border-border rounded-lg text-xs text-text-muted leading-relaxed space-y-1.5">
              <div>
                <span className="font-medium text-text-secondary">AI detection: </span>
                {saplingFeedback.score === null
                  ? "Sapling unavailable — aggressive rewrite applied as fallback."
                  : saplingFeedback.action === "skipped"
                    ? `Score ${Math.round(saplingFeedback.score * 100)}% — reads as human, no rewrite needed.`
                    : saplingFeedback.action === "aggressive"
                      ? `Score ${Math.round(saplingFeedback.score * 100)}% — full aggressive rewrite applied.`
                      : `Score ${Math.round(saplingFeedback.score * 100)}% — targeted rewrite applied to ${saplingFeedback.flaggedSentences} flagged sentence${saplingFeedback.flaggedSentences !== 1 ? "s" : ""}.`
                }
              </div>
              {saplingFeedback.sentenceScores && saplingFeedback.sentenceScores.length > 0 && (
                <details className="cursor-pointer">
                  <summary className="text-text-secondary font-medium select-none">Per-sentence scores ({saplingFeedback.sentenceScores.length})</summary>
                  <ul className="mt-1 space-y-1">
                    {saplingFeedback.sentenceScores.map((s, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <span className={`shrink-0 font-mono ${s.score >= 0.5 ? "text-error" : "text-success"}`}>
                          {Math.round(s.score * 100)}%
                        </span>
                        <span className="text-text-muted">{s.sentence}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {!hasAvatar && coverLetter && (
            <p className="mt-3 text-xs text-text-muted">
              Tip: add a profile photo in{" "}
              <a href="/profile" className="text-accent hover:text-accent-dark transition-colors underline">your Profile</a>{" "}
              to include it in the downloaded PDF.
            </p>
          )}
        </div>
      </div>

      {/* ── Get advice & rewrite panel ────────────────────────────── */}
      {coverLetter && (
        <div className="border-t border-border px-6 py-5">
          <div className="flex items-center gap-2.5 mb-3">
            <WandIcon className="w-4 h-4 text-text-muted shrink-0" />
            <h2 className="flex-1 text-sm font-semibold text-text-primary">Get advice &amp; rewrite</h2>
            <button
              onClick={handleCopyAndOpenGemini}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              {geminiCopied ? (
                <><CheckIcon className="w-3.5 h-3.5 text-success" />Copied &amp; opened</>
              ) : (
                <><CopyIcon className="w-3.5 h-3.5" />Copy &amp; open Gemini</>
              )}
            </button>
          </div>
          <p className="text-xs text-text-muted mb-3">
            Copy your letter into Gemini and ask for feedback or rewrite suggestions. Paste those suggestions here, then click <strong className="text-text-primary">Recreate with advice</strong> (top of the letter) to generate a new version.
          </p>
          <textarea
            value={styleAdvice}
            onChange={(e) => { setStyleAdvice(e.target.value); setAdviceSaved(false); }}
            placeholder="Paste advice or suggestions from Gemini here..."
            rows={8}
            className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary leading-relaxed placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-y transition-colors"
          />
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-text-muted">Advice is saved automatically when you click Recreate.</p>
            <button
              onClick={handleSaveAdvice}
              disabled={adviceSaving || !styleAdvice.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {adviceSaving ? (
                <><SpinnerIcon className="w-3.5 h-3.5 animate-spin" />Saving...</>
              ) : adviceSaved ? (
                <><CheckIcon className="w-3.5 h-3.5 text-success" />Saved</>
              ) : (
                "Save advice"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function WandIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4l5 5L8 21l-5-1 1-5L15 4z" />
      <path d="M18 2l4 4" />
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

function LetterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4zM4 8l8 5 8-5" />
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

function SummaryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
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
