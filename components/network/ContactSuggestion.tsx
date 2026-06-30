"use client";

import { useState, useEffect } from "react";
import type { Connection } from "@/types";
import type { ContactSuggestion as SuggestionType } from "@/agent/suggest-contact";
import type { LinkedInMessage as MessageType } from "@/agent/linkedin-message";
import { isRecruiter, isManager } from "@/lib/network-utils";

type Props = {
  jobTitle: string;
  company: string;
  connections: Connection[];
};

export function ContactSuggestion({ jobTitle, company, connections }: Props) {
  const [suggestLoading, setSuggestLoading] = useState(true);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = connections.find((c) => c.id === selectedId) ?? null;

  const [msgLoading, setMsgLoading] = useState(false);
  const [message, setMessage] = useState<MessageType | null>(null);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (connections.length === 0) return;
    let cancelled = false;

    async function fetchSuggestion() {
      setSuggestLoading(true);
      setSuggestError(null);
      try {
        const res = await fetch("/api/agent/suggest-contact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobTitle, company, connections }),
        });
        const data = await res.json() as { success: boolean; suggestion?: SuggestionType; error?: string };
        if (cancelled) return;
        if (!data.success || !data.suggestion) {
          setSuggestError(data.error ?? "Failed to get suggestion");
          return;
        }
        setRecommendedId(data.suggestion.connectionId);
        setReasoning(data.suggestion.reasoning);
        setSelectedId(data.suggestion.connectionId);
      } catch {
        if (!cancelled) setSuggestError("Something went wrong.");
      } finally {
        if (!cancelled) setSuggestLoading(false);
      }
    }

    fetchSuggestion();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (connections.length === 0) return null;

  function handleSelect(id: string) {
    setSelectedId(id);
    setMessage(null);
    setMsgError(null);
  }

  async function handleGenerateMessage() {
    if (!selected) return;
    setMsgLoading(true);
    setMsgError(null);
    try {
      const res = await fetch("/api/agent/linkedin-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: {
            first_name: selected.first_name,
            last_name: selected.last_name,
            position: selected.position,
            company: selected.company,
          },
          jobTitle,
          company,
        }),
      });
      const data = await res.json() as { success: boolean; result?: MessageType; error?: string };
      if (!data.success || !data.result) {
        setMsgError(data.error ?? "Failed to generate message");
        return;
      }
      setMessage(data.result);
    } catch {
      setMsgError("Something went wrong. Please try again.");
    } finally {
      setMsgLoading(false);
    }
  }

  async function handleCopy() {
    if (!message) return;
    await navigator.clipboard.writeText(message.message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
      <p className="text-base font-semibold text-text-primary">Select contact to reach out to</p>
      <p className="text-sm text-text-muted mt-0.5 mb-4">
        {connections.length} {connections.length === 1 ? "contact" : "contacts"} in {company}
      </p>

      {suggestLoading && (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <SpinnerIcon className="w-4 h-4 animate-spin shrink-0" />
          Finding best contact…
        </div>
      )}

      {suggestError && (
        <p className="text-sm text-error">{suggestError}</p>
      )}

      {!suggestLoading && !suggestError && (
        <div className="space-y-3">
          {/* Connection list — recommended first, then rest */}
          <div className="space-y-2">
            {[...connections].sort((a, b) => (a.id === recommendedId ? -1 : b.id === recommendedId ? 1 : 0)).map((c) => {
              const isSelected = c.id === selectedId;
              const isRecommended = c.id === recommendedId;
              const recruiter = isRecruiter(c);
              const manager = isManager(c);
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelect(c.id)}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? "border-2 border-accent bg-accent-light/20"
                      : "border border-border bg-surface-secondary hover:border-border-focus"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-accent-light flex items-center justify-center text-xs font-semibold text-accent shrink-0 mt-0.5">
                    {c.first_name[0]}{c.last_name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-text-primary">
                        {c.first_name} {c.last_name}
                      </span>
                      {isRecommended && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-accent text-accent-foreground leading-none">
                          Recommended
                        </span>
                      )}
                      {recruiter && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-linkedin text-linkedin-foreground leading-none">
                          Recruiter
                        </span>
                      )}
                      {!recruiter && manager && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-info-light text-info-foreground leading-none">
                          Manager
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary truncate">{c.position}</p>
                  </div>
                  {isSelected && (
                    <CheckIcon className="w-4 h-4 text-accent shrink-0 self-center" />
                  )}
                </button>
              );
            })}
          </div>

          {/* AI reasoning for the recommended contact */}
          {reasoning && selectedId === recommendedId && (
            <p className="text-xs text-text-muted px-1">{reasoning}</p>
          )}

          {/* LinkedIn link for selected */}
          {selected?.linkedin_url && (
            <a
              href={selected.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-linkedin hover:underline px-1 block"
            >
              View {selected.first_name} on LinkedIn
            </a>
          )}

          {/* Message generation */}
          {!message && (
            <button
              onClick={handleGenerateMessage}
              disabled={msgLoading || !selected}
              className="text-xs font-medium text-linkedin hover:underline disabled:opacity-50 transition-colors"
            >
              {msgLoading ? "Generating message…" : "Generate LinkedIn message"}
            </button>
          )}
          {msgError && <p className="text-xs text-error">{msgError}</p>}
          {message && (
            <div className="bg-surface-secondary border border-border-light rounded-lg p-3 space-y-2">
              <p className="text-xs text-text-primary leading-relaxed">{message.message}</p>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-text-muted">{message.message.length} / 300 chars</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateMessage}
                    disabled={msgLoading}
                    className="text-[11px] text-text-muted hover:text-text-secondary disabled:opacity-50 transition-colors"
                  >
                    Regenerate
                  </button>
                  <button
                    onClick={handleCopy}
                    className="text-[11px] font-medium text-accent hover:text-accent-dark transition-colors"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10l4 4 8-8" />
    </svg>
  );
}
