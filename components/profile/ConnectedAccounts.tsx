"use client";

export function ConnectedAccounts() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 shadow-[0px_1px_3px_rgba(0,0,0,0.1),0px_1px_2px_-1px_rgba(0,0,0,0.1)]">
      <h2 className="text-base font-semibold text-text-primary">Connected Accounts</h2>
      <p className="text-sm text-text-secondary mt-1">
        Connect your LinkedIn to let the agent handle manual apply with LinkedIn workflows.
      </p>

      <div className="mt-4 border border-border rounded-xl p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-linkedin flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
              <path d="M6.94 5a2 2 0 1 1-4-.002 2 2 0 0 1 4 .002zM7 8.48H3V21h4V8.48zm6.32 0H9.34V21h3.94v-6.57c0-3.66 4.77-4 4.77 0V21H22v-7.93c0-6.17-7.06-5.94-8.72-2.91l.04-1.68z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">LinkedIn</p>
            <p className="text-xs text-text-muted">Not connected</p>
          </div>
        </div>
        <button
          type="button"
          className="px-5 py-2.5 bg-linkedin text-linkedin-foreground text-sm font-medium rounded-full hover:opacity-90 transition-opacity shrink-0"
        >
          Connect LinkedIn
        </button>
      </div>
    </div>
  );
}
