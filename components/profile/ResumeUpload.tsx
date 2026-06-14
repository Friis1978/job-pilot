"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { insforge } from "@/lib/insforge-client";
import { updateResumeUrl } from "@/actions/profile";
import type { ProfileFormInput } from "@/types";

type Props = {
  initialResumeUrl?: string | null;
  userId: string | null;
  onExtract?: (data: Partial<ProfileFormInput>) => void;
  embedded?: boolean;
};

export function ResumeUpload({ initialResumeUrl, userId, onExtract, embedded = false }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(
    initialResumeUrl ? "resume.pdf" : null,
  );
  const [isOpen, setIsOpen] = useState(!initialResumeUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    setExtractError(null);

    try {
      if (!userId) {
        setUploadError("Not authenticated.");
        setUploading(false);
        return;
      }

      const resumePath = `${userId}/resume.pdf`;

      // Delete existing file first so we can reuse the same path
      await insforge.storage.from("resumes").remove(resumePath);

      const { data, error } = await insforge.storage
        .from("resumes")
        .upload(resumePath, file);

      if (error || !data) {
        console.error("[ResumeUpload] upload error", error);
        setUploadError("Upload failed. Please try again.");
        setUploading(false);
        return;
      }

      const result = await updateResumeUrl(data.url);
      if (!result.success) {
        setUploadError("Uploaded but failed to save URL. Please try again.");
        setUploading(false);
        return;
      }

      setFileName(file.name);
      setIsOpen(true);
    } catch (err) {
      console.error("[ResumeUpload] unexpected error", err);
      setUploadError("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleExtract() {
    setExtracting(true);
    setExtractError(null);

    try {
      const response = await fetch("/api/resume/extract", { method: "POST" });
      const json = await response.json() as { data?: Partial<ProfileFormInput>; error?: string };

      if (!response.ok || json.error) {
        setExtractError(json.error ?? "Extraction failed. Please try again.");
        return;
      }

      if (json.data && onExtract) {
        onExtract(json.data);
      }
    } catch (err) {
      console.error("[ResumeUpload] extract error", err);
      setExtractError("Something went wrong. Please try again.");
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
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !uploading && fileInputRef.current?.click()}
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
            d="M22 30v-12M17 23l5-5 5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {uploading ? (
          <p className="text-sm font-medium text-text-secondary">Uploading…</p>
        ) : fileName ? (
          <p className="text-sm font-medium text-text-primary">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary">Click to upload or drag and drop</p>
            <p className="text-xs text-text-muted">PDF formatting only. Maximum file size 5MB.</p>
          </>
        )}

        <button
          type="button"
          disabled={uploading}
          onClick={(e) => {
            e.stopPropagation();
            if (!uploading) fileInputRef.current?.click();
          }}
          className="mt-2 px-4 py-2 bg-surface border border-border text-sm font-medium text-text-primary rounded-lg hover:bg-surface-secondary transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading ? "Uploading…" : "Select Resume"}
        </button>
      </div>

      {uploadError && (
        <p className="mt-2 text-xs text-error">{uploadError}</p>
      )}

      {fileName && (
        <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-4 flex-wrap">
          <p className="text-xs text-text-muted">
            Auto-fill the form below with data extracted from your resume.
          </p>
          <button
            type="button"
            disabled={extracting}
            onClick={handleExtract}
            className="flex items-center gap-2 px-4 py-2 bg-surface border border-accent text-accent text-sm font-medium rounded-lg hover:bg-accent/5 transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {extracting ? (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="animate-spin">
                  <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="10 8" />
                </svg>
                Extracting…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 7h10M7 2l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Extract from Resume
              </>
            )}
          </button>
        </div>
      )}

      {extractError && (
        <p className="mt-2 text-xs text-error">{extractError}</p>
      )}
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
          {!isOpen && fileName && (
            <span className="text-xs text-text-muted ml-1">— {fileName}</span>
          )}
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
          <p className="text-xs text-text-muted mt-0.5">
            {fileName ? fileName : "No file uploaded"}
          </p>
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
