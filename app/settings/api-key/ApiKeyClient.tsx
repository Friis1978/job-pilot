"use client";

import { useState } from "react";

export type KeyStatus = {
  hasKey: boolean;
  keyHint: string | null;
  status: "active" | "invalid" | null;
  lastVerifiedAt: string | null;
};

/**
 * Reads a JSON body without assuming there is one. A crashed route can return
 * an empty 500, and res.json() on an empty body throws "Unexpected end of JSON
 * input" — which would replace the real HTTP failure with a parser error the
 * user cannot act on.
 */
async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function ApiKeyClient({ initial }: { initial: KeyStatus }) {
  const [state, setState] = useState<KeyStatus>(initial);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState<"save" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy("save");
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/ai-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      const data = await readJson(res);
      if (!res.ok) throw new Error((data.error as string) ?? `Save failed (${res.status}).`);
      setState(data as KeyStatus);
      // Clear immediately on success — there is no reason for the key to sit in
      // a DOM node after it has been stored.
      setValue("");
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy("remove");
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/ai-key", { method: "DELETE" });
      const data = await readJson(res);
      if (!res.ok) throw new Error((data.error as string) ?? `Remove failed (${res.status}).`);
      setState(data as KeyStatus);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const rejected = state.hasKey && state.status === "invalid";

  return (
    <div className="flex flex-col gap-6">
      {/* Current key */}
      <div
        className={`bg-surface border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          rejected ? "border-error/40" : "border-border"
        }`}
      >
        <div>
          <p className="text-sm text-text-muted mb-1">Your Anthropic API key</p>
          {state.hasKey ? (
            <>
              <p className="text-2xl font-bold text-text-primary font-mono">
                sk-ant-…{state.keyHint}
              </p>
              {rejected ? (
                <p className="text-xs text-error mt-1">
                  Anthropic rejected this key. Replace it below to keep using AI features.
                </p>
              ) : (
                <p className="text-xs text-text-muted mt-1">
                  Active
                  {state.lastVerifiedAt
                    ? ` — verified ${new Date(state.lastVerifiedAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}`
                    : ""}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-text-muted">Not set</p>
              <p className="text-xs text-text-muted mt-1">
                Add a key to run job scoring, cover letters and resumes on your own account.
              </p>
            </>
          )}
        </div>
        {state.hasKey && (
          <button
            onClick={remove}
            disabled={busy !== null}
            className="px-4 py-2 rounded-xl text-sm font-medium text-error border border-error/30 hover:bg-error/5 transition-colors disabled:opacity-60 self-start sm:self-auto"
          >
            {busy === "remove" ? "Removing…" : "Remove"}
          </button>
        )}
      </div>

      {/* Set / replace */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">
            {state.hasKey ? "Replace key" : "Add your key"}
          </h2>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="anthropic-key" className="text-sm text-text-secondary">
              Paste your key from{" "}
              <a
                href="https://platform.claude.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                the Anthropic Console
              </a>
            </label>
            <input
              id="anthropic-key"
              // `password` so it is masked on screen, and autoComplete off so no
              // browser or extension offers to remember a billing credential.
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSaved(false);
              }}
              placeholder="sk-ant-api03-…"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {error && <p className="text-sm text-error">{error}</p>}
          {saved && <p className="text-sm text-success">Key saved and verified.</p>}

          <div className="flex items-center gap-3">
            <button
              onClick={save}
              disabled={busy !== null || value.trim().length === 0}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              {busy === "save" ? "Verifying…" : state.hasKey ? "Replace key" : "Save key"}
            </button>
            <p className="text-xs text-text-muted">
              Checked against Anthropic before it is saved.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-surface-secondary border border-border-light rounded-2xl px-6 py-5">
        <h3 className="text-sm font-semibold text-text-primary mb-2">How your key is stored</h3>
        <ul className="text-xs text-text-muted flex flex-col gap-1.5">
          <li>Encrypted before it reaches the database — the stored value is unreadable without a server key held outside it.</li>
          <li>Never sent back to your browser. Only the last four characters are shown, here and nowhere else.</li>
          <li>Not visible to anyone else, including administrators.</li>
          <li>Used only to run this app&apos;s AI features on your own Anthropic account, so usage is billed to you.</li>
          <li>Remove it at any time — it is deleted, not deactivated.</li>
        </ul>
      </div>
    </div>
  );
}
