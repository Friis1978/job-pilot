"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import type { ParsedConnection } from "@/lib/csv-parser";
import { isRecruiter as checkRecruiter, isManager as checkManager } from "@/lib/network-utils";
import type { Connection } from "@/types";

type Props = {
  connections: ParsedConnection[];
  fileName: string;
  importing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

function toPreviewConnection(c: ParsedConnection): Connection {
  return { ...c, id: "", user_id: "", is_favorite: false, notes: null, imported_at: "", created_at: "" };
}

export function ImportPreview({ connections, fileName, importing, onConfirm, onCancel }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const recruiterCount = connections.filter((c) => checkRecruiter(toPreviewConnection(c))).length;
  const managerCount = connections.filter((c) => checkManager(toPreviewConnection(c))).length;
  const companies = new Set(connections.map((c) => c.company.toLowerCase().trim()).filter(Boolean)).size;
  const preview = connections.slice(0, 5);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-overlay/40" onClick={onCancel} />
      <div className="relative bg-surface border border-border rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Import Connections</h2>
          <p className="text-sm text-text-secondary mt-0.5">{fileName}</p>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Connections", value: connections.length },
              { label: "Recruiters", value: recruiterCount },
              { label: "Managers", value: managerCount },
              { label: "Companies", value: companies },
            ].map(({ label, value }) => (
              <div key={label} className="bg-surface-secondary border border-border-light rounded-xl p-3 text-center">
                <p className="text-xl font-semibold text-text-primary">{value}</p>
                <p className="text-xs text-text-secondary mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Preview (first 5)</p>
            <div className="divide-y divide-border-light border border-border-light rounded-xl overflow-hidden">
              {preview.map((c, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-surface text-sm">
                  <div className="w-7 h-7 rounded-full bg-accent-light flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-text-primary">{c.first_name} {c.last_name}</span>
                    {c.position && <span className="text-text-secondary"> · {c.position}</span>}
                  </div>
                  <span className="text-text-muted shrink-0 truncate max-w-32">{c.company}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Importing will replace all previously imported connections. Notes and favorites will be lost.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={importing}
            className="px-4 py-2 rounded-lg text-sm font-medium text-text-secondary border border-border hover:bg-surface-secondary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={importing}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {importing ? "Importing…" : `Import ${connections.length} connections`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
