"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

type BulkOpsContextValue = {
  rescoring: boolean;
  researching: boolean;
  rescoreAll: () => void;
  researchAll: () => void;
};

const BulkOpsContext = createContext<BulkOpsContextValue | null>(null);

export function BulkOpsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [rescoring, setRescoring] = useState(false);
  const [researching, setResearching] = useState(false);

  const rescoreAll = useCallback(async () => {
    if (rescoring) return;
    setRescoring(true);
    try {
      const res = await fetch("/api/jobs/rescore-all", { method: "POST" });
      const json = await res.json() as { updated?: number; failed?: number; error?: string };
      if (!res.ok || json.error) {
        toast(json.error ?? "Re-scoring failed.", "error");
        return;
      }
      toast(`Re-scored ${json.updated} job${json.updated === 1 ? "" : "s"}${json.failed ? ` (${json.failed} failed)` : ""}.`, "success");
      router.refresh();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setRescoring(false);
    }
  }, [rescoring, router]);

  const researchAll = useCallback(async () => {
    if (researching) return;
    setResearching(true);
    try {
      const res = await fetch("/api/jobs/research-all", { method: "POST" });
      const json = await res.json() as { researched?: number; failed?: number; skipped?: number; total?: number; error?: string };
      if (!res.ok || json.error) {
        toast(json.error ?? "Research failed.", "error");
        return;
      }
      if ((json.total ?? 0) === 0) {
        toast("No jobs to research.", "success");
      } else {
        const parts = [`Researched ${json.researched} of ${json.total} jobs`];
        if (json.failed) parts.push(`${json.failed} failed`);
        toast(parts.join(", ") + ".", "success");
      }
      router.refresh();
    } catch {
      toast("Could not reach the server.", "error");
    } finally {
      setResearching(false);
    }
  }, [researching, router]);

  return (
    <BulkOpsContext.Provider value={{ rescoring, researching, rescoreAll, researchAll }}>
      {children}
      {(rescoring || researching) && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {rescoring && (
            <div className="bg-surface border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 text-sm">
              <SpinnerIcon className="w-4 h-4 text-accent animate-spin shrink-0" />
              <span className="text-text-primary font-medium">Re-scoring all jobs…</span>
            </div>
          )}
          {researching && (
            <div className="bg-surface border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 text-sm">
              <SpinnerIcon className="w-4 h-4 text-accent animate-spin shrink-0" />
              <span className="text-text-primary font-medium">Researching companies…</span>
            </div>
          )}
        </div>
      )}
    </BulkOpsContext.Provider>
  );
}

export function useBulkOps() {
  const ctx = useContext(BulkOpsContext);
  if (!ctx) throw new Error("useBulkOps must be used within BulkOpsProvider");
  return ctx;
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
