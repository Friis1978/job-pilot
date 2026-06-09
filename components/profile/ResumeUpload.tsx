"use client";

import { useState, useRef, type DragEvent, type ChangeEvent } from "react";

export function ResumeUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (file?.type === "application/pdf") {
      setFileName(file.name);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      <h2 className="text-base font-semibold text-text-primary">Resume</h2>
      <p className="text-sm text-text-secondary mt-1">
        Upload an existing resume to auto-fill the profile, or generate a new tailored one from your details below.
      </p>

      <div
        role="button"
        tabIndex={0}
        className={`mt-4 border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
          isDragging ? "border-accent bg-accent-muted" : "border-border hover:border-accent/50"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
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

        {fileName ? (
          <p className="text-sm font-medium text-text-primary">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium text-text-primary">Click to upload or drag and drop</p>
            <p className="text-xs text-text-muted">PDF formatting only. Maximum file size 5MB.</p>
          </>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="mt-2 px-4 py-2 bg-surface border border-border text-sm font-medium text-text-primary rounded-lg hover:bg-surface-secondary transition-colors"
        >
          Select Resume
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
        <p className="text-xs text-text-muted">Need a fresh document based on the fields below?</p>
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground text-sm font-medium rounded-lg hover:bg-accent-dark transition-colors shrink-0"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M7.5 1.5c3.314 0 6 2.686 6 6s-2.686 6-6 6-6-2.686-6-6 2.686-6 6-6zM7.5 4v7M4 7.5h7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          Generate Resume from Profile
        </button>
      </div>
    </div>
  );
}
