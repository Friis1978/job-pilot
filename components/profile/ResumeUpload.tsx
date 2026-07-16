"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { toast } from "@/lib/toast";
import type { ProfileFormInput } from "@/types";

type Props = {
  initialResumeUrl?: string | null;
  userId: string | null;
  onExtract?: (data: Partial<ProfileFormInput>) => void;
  embedded?: boolean;
};

export function ResumeUpload({ userId, onExtract, embedded = false }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast("Only PDF files are supported.", "error");
      return;
    }
    if (!userId) {
      toast("Not authenticated.", "error");
      return;
    }

    setExtracting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const response = await fetch("/api/resume/extract", { method: "POST", body: fd });
      const json = await response.json() as { data?: Partial<ProfileFormInput>; error?: string };

      if (!response.ok || json.error) {
        toast(json.error ?? "Extraction failed. Please try again.", "error");
        return;
      }

      if (json.data && onExtract) {
        onExtract(json.data);
      }
    } catch (err) {
      console.error("[ResumeUpload] extract error", err);
      toast("Something went wrong. Please try again.", "error");
    } finally {
      setExtracting(false);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  const bodyContent = (
    <div className="flex flex-col gap-0">
      <div
        role="button"
        tabIndex={0}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          isDragging ? "border-accent bg-accent-muted" : "border-border hover:border-accent/50"
        } ${extracting ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !extracting && fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !extracting && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" className="text-text-muted">
          <circle cx="22" cy="22" r="21" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M22 14v10M17 19l5-5 5 5M14 30h16"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {extracting ? (
          <p className="text-sm text-text-muted text-center">Extracting profile data…</p>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary text-center">
              Drop your resume here or click to browse
            </p>
            <p className="text-xs text-text-muted">PDF only — data is extracted instantly, not stored</p>
          </>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="pt-6 border-t border-border mt-6">
        <button
          type="button"
          onClick={() => setIsOpen((o) => !o)}
          className="w-full flex items-center gap-2 mb-4 text-left group"
        >
          <svg
            width="16" height="16" viewBox="0 0 16 16" fill="none"
            stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
          >
            <path d="M6 4l4 4-4 4" />
          </svg>
          <h3 className="text-sm font-semibold text-text-primary">Resume</h3>
        </button>
        {isOpen && bodyContent}
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)] overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-6 py-4 text-left hover:bg-surface-secondary transition-colors"
      >
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-text-muted transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        >
          <path d="M6 4l4 4-4 4" />
        </svg>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold text-text-primary">Resume</h2>
          <p className="text-xs text-text-muted mt-0.5">Upload to auto-fill your profile</p>
        </div>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 border-t border-border pt-5">
          {bodyContent}
        </div>
      )}
    </div>
  );
}
