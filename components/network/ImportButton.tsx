"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { parseLinkedInCSV } from "@/lib/csv-parser";
import type { ParsedConnection } from "@/lib/csv-parser";
import { ImportPreview } from "@/components/network/ImportPreview";

export function ImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [preview, setPreview] = useState<{ connections: ParsedConnection[]; fileName: string } | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { connections, errors } = parseLinkedInCSV(text);

      if (errors.length > 0) {
        toast(errors[0], "error");
        return;
      }

      setPreview({ connections, fileName: file.name });
    };
    reader.readAsText(file);

    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleConfirm() {
    if (!preview) return;
    setImporting(true);
    try {
      const res = await fetch("/api/network/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connections: preview.connections,
          file_name: preview.fileName,
        }),
      });
      const data = await res.json() as { success: boolean; count?: number; error?: string };
      if (!data.success) {
        toast(data.error ?? "Import failed", "error");
        return;
      }
      toast(`Imported ${data.count} connections`, "success");
      setPreview(null);
      router.refresh();
    } catch {
      toast("Something went wrong during import", "error");
    } finally {
      setImporting(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent-dark transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Import CSV
      </button>

      {preview && (
        <ImportPreview
          connections={preview.connections}
          fileName={preview.fileName}
          importing={importing}
          onConfirm={handleConfirm}
          onCancel={() => setPreview(null)}
        />
      )}
    </>
  );
}
