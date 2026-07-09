"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "@/lib/toast";
import type { Connection, LinkedInRecommendation, WorkExperience } from "@/types";

type Props = {
  connections: Connection[];
  workExperience: WorkExperience[];
  initialRecommendations: LinkedInRecommendation[];
};

const EMPTY_FORM = {
  recommender_name: "",
  recommender_title: "",
  recommender_linkedin_url: "",
  avatar_url: "",
  work_experience_company: "",
  recommendation_text: "",
  recommendation_date: "",
};

type FormState = typeof EMPTY_FORM;

export function RecommendationsView({ connections, workExperience, initialRecommendations }: Props) {
  const [recs, setRecs] = useState<LinkedInRecommendation[]>(initialRecommendations);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [connSearch, setConnSearch] = useState("");
  const [connDropdownOpen, setConnDropdownOpen] = useState(false);
  const connSearchRef = useRef<HTMLInputElement>(null);
  const connDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!connDropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (connDropdownRef.current && !connDropdownRef.current.contains(e.target as Node)) {
        setConnDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [connDropdownOpen]);

  function handleConnectionSelect(connectionId: string) {
    if (!connectionId) {
      setForm((f) => ({ ...f, recommender_name: "", recommender_title: "", recommender_linkedin_url: "", avatar_url: "" }));
      return;
    }
    const conn = connections.find((c) => c.id === connectionId);
    if (!conn) return;
    setForm((f) => ({
      ...f,
      recommender_name: `${conn.first_name} ${conn.last_name}`.trim(),
      recommender_title: conn.position ?? "",
      recommender_linkedin_url: conn.linkedin_url ?? "",
    }));
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>, recId?: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (recId) fd.append("recId", recId);
      const res = await fetch("/api/recommendations/avatar", { method: "POST", body: fd });
      const json = await res.json() as { url?: string; error?: string };
      if (!res.ok || json.error) { toast(json.error ?? "Upload failed.", "error"); return; }
      setForm((f) => ({ ...f, avatar_url: json.url! }));
    } catch {
      toast("Upload failed.", "error");
    } finally {
      setAvatarUploading(false);
    }
  }

  function startEdit(rec: LinkedInRecommendation) {
    setEditingId(rec.id);
    setAvatarPreview(rec.avatar_url ?? null);
    setForm({
      recommender_name: rec.recommender_name,
      recommender_title: rec.recommender_title,
      recommender_linkedin_url: rec.recommender_linkedin_url ?? "",
      avatar_url: rec.avatar_url ?? "",
      work_experience_company: rec.work_experience_company ?? "",
      recommendation_text: rec.recommendation_text,
      recommendation_date: rec.recommendation_date,
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setAvatarPreview(null);
    setForm(EMPTY_FORM);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSave() {
    if (!form.recommender_name.trim()) { toast("Recommender name is required.", "error"); return; }
    if (!form.recommendation_text.trim()) { toast("Recommendation text is required.", "error"); return; }
    if (!form.recommendation_date) { toast("Date is required.", "error"); return; }

    setSaving(true);
    try {
      const payload = {
        recommender_name: form.recommender_name.trim(),
        recommender_title: form.recommender_title.trim(),
        recommender_linkedin_url: form.recommender_linkedin_url.trim() || null,
        avatar_url: form.avatar_url.trim() || null,
        work_experience_company: form.work_experience_company || null,
        recommendation_text: form.recommendation_text.trim(),
        recommendation_date: form.recommendation_date,
      };

      if (editingId) {
        const res = await fetch(`/api/recommendations/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json() as { recommendation?: LinkedInRecommendation; error?: string };
        if (!res.ok || json.error) { toast(json.error ?? "Failed to update.", "error"); return; }
        setRecs((prev) => prev.map((r) => r.id === editingId ? json.recommendation! : r));
        toast("Recommendation updated.", "success");
        cancelEdit();
      } else {
        const res = await fetch("/api/recommendations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json() as { recommendation?: LinkedInRecommendation; error?: string };
        if (!res.ok || json.error) { toast(json.error ?? "Failed to save.", "error"); return; }
        setRecs((prev) => [json.recommendation!, ...prev]);
        toast("Recommendation added.", "success");
        setForm(EMPTY_FORM);
        setAvatarPreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch {
      toast("Failed to save recommendation.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/recommendations/${id}`, { method: "DELETE" });
      if (!res.ok) { toast("Failed to delete.", "error"); return; }
      setRecs((prev) => prev.filter((r) => r.id !== id));
      toast("Recommendation removed.", "success");
      if (editingId === id) cancelEdit();
    } catch {
      toast("Failed to delete.", "error");
    } finally {
      setDeleting(null);
    }
  }

  const companies = workExperience.map((w) => w.company).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-surface border border-border rounded-2xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-text-primary">
          {editingId ? "Edit Recommendation" : "Add Recommendation"}
        </h3>

        {/* Connection quick-fill */}
        {!editingId && connections.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Auto-fill from Connection</label>
            <div className="relative" ref={connDropdownRef}>
              <div
                className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary cursor-pointer flex items-center justify-between gap-2 hover:border-accent transition-colors"
                onClick={() => { setConnDropdownOpen((o) => !o); setTimeout(() => connSearchRef.current?.focus(), 50); }}
              >
                <span className={connSearch || form.recommender_name ? "text-text-primary" : "text-text-muted"}>
                  {form.recommender_name || "Select a connection (optional)…"}
                </span>
                <svg className="w-4 h-4 text-text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {connDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full bg-surface border border-border rounded-xl shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        ref={connSearchRef}
                        type="text"
                        value={connSearch}
                        onChange={(e) => setConnSearch(e.target.value)}
                        placeholder="Search connections…"
                        className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-secondary border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => { handleConnectionSelect(""); setConnSearch(""); setConnDropdownOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm text-text-muted hover:bg-surface-secondary transition-colors"
                    >
                      None (manual entry)
                    </button>
                    {connections
                      .filter((c) => {
                        if (!connSearch) return true;
                        const q = connSearch.toLowerCase();
                        return (
                          c.first_name.toLowerCase().includes(q) ||
                          c.last_name.toLowerCase().includes(q) ||
                          c.company.toLowerCase().includes(q)
                        );
                      })
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { handleConnectionSelect(c.id); setConnSearch(""); setConnDropdownOpen(false); }}
                          className="w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
                        >
                          <span className="font-medium">{c.first_name} {c.last_name}</span>
                          <span className="text-text-muted ml-2">· {c.company}</span>
                        </button>
                      ))}
                    {connections.filter((c) => {
                      if (!connSearch) return true;
                      const q = connSearch.toLowerCase();
                      return c.first_name.toLowerCase().includes(q) || c.last_name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q);
                    }).length === 0 && (
                      <p className="px-3 py-2 text-sm text-text-muted">No connections match.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Recommender Name *</label>
            <input
              type="text"
              value={form.recommender_name}
              onChange={(e) => setForm((f) => ({ ...f, recommender_name: e.target.value }))}
              placeholder="Jane Smith"
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Recommender Title</label>
            <input
              type="text"
              value={form.recommender_title}
              onChange={(e) => setForm((f) => ({ ...f, recommender_title: e.target.value }))}
              placeholder="Engineering Manager"
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">LinkedIn URL</label>
            <input
              type="url"
              value={form.recommender_linkedin_url}
              onChange={(e) => setForm((f) => ({ ...f, recommender_linkedin_url: e.target.value }))}
              placeholder="https://linkedin.com/in/janesmith"
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Profile Photo</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="relative w-12 h-12 rounded-full border-2 border-dashed border-border hover:border-accent transition-colors overflow-hidden shrink-0 disabled:opacity-60"
              >
                {avatarPreview || form.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview ?? form.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="flex items-center justify-center w-full h-full">
                    <CameraIcon className="w-5 h-5 text-text-muted" />
                  </span>
                )}
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <SpinnerIcon className="w-4 h-4 animate-spin text-white" />
                  </div>
                )}
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="text-sm text-accent hover:underline disabled:opacity-50"
              >
                {avatarUploading ? "Uploading…" : (avatarPreview || form.avatar_url) ? "Change photo" : "Upload photo"}
              </button>
              {(avatarPreview || form.avatar_url) && !avatarUploading && (
                <button
                  type="button"
                  onClick={() => { setAvatarPreview(null); setForm((f) => ({ ...f, avatar_url: "" })); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="text-sm text-text-muted hover:text-danger transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarChange(e, editingId ?? undefined)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Your Company at the time</label>
            <select
              value={form.work_experience_company}
              onChange={(e) => setForm((f) => ({ ...f, work_experience_company: e.target.value }))}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            >
              <option value="">Former colleague (no company)</option>
              {companies.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Date *</label>
            <input
              type="date"
              value={form.recommendation_date}
              onChange={(e) => setForm((f) => ({ ...f, recommendation_date: e.target.value }))}
              className="px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-text-muted uppercase tracking-wide">Recommendation Text *</label>
          <textarea
            value={form.recommendation_text}
            onChange={(e) => setForm((f) => ({ ...f, recommendation_text: e.target.value }))}
            placeholder="Paste or type the recommendation text here…"
            rows={5}
            className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent resize-y"
          />
        </div>

        <div className="flex gap-2 justify-end">
          {editingId && (
            <button
              onClick={cancelEdit}
              className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-lg text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50"
          >
            {saving ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <PlusIcon className="w-4 h-4" />}
            {saving ? "Saving…" : editingId ? "Update" : "Add Recommendation"}
          </button>
        </div>
      </div>

      {/* List */}
      {recs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-center">
          <QuoteIcon className="w-8 h-8 text-border" />
          <p className="text-sm font-medium text-text-primary">No recommendations yet</p>
          <p className="text-xs text-text-muted">Add LinkedIn recommendations above — they&apos;ll appear in your tailored resume.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recs.map((rec) => (
              <div key={rec.id} className="bg-surface border border-border rounded-2xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                  {rec.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={rec.avatar_url} alt={rec.recommender_name} className="w-10 h-10 rounded-full object-cover shrink-0 border border-border" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-surface-secondary border border-border flex items-center justify-center shrink-0">
                      <span className="text-sm font-semibold text-text-muted">{rec.recommender_name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {rec.recommender_linkedin_url ? (
                          <a
                            href={rec.recommender_linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-accent hover:underline"
                          >
                            {rec.recommender_name}
                          </a>
                        ) : (
                          <span className="text-sm font-semibold text-text-primary">{rec.recommender_name}</span>
                        )}
                        {rec.recommender_title && (
                          <p className="text-xs text-text-muted">
                            {rec.recommender_title}
                            {rec.work_experience_company ? ` · ${rec.work_experience_company}` : " · Former colleague"}
                          </p>
                        )}
                        <p className="text-xs text-text-muted mt-0.5">{formatDate(rec.recommendation_date)}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(rec)}
                          className="p-1.5 rounded-lg text-text-muted hover:bg-surface-secondary hover:text-text-primary transition-colors"
                          title="Edit"
                        >
                          <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          disabled={deleting === rec.id}
                          className="p-1.5 rounded-lg text-text-muted hover:bg-surface-secondary hover:text-danger transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deleting === rec.id ? <SpinnerIcon className="w-4 h-4 animate-spin" /> : <TrashIcon className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mt-2 line-clamp-3">{rec.recommendation_text}</p>
                  </div>
                </div>
              </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(d: string) {
  if (!d) return "";
  const date = new Date(d + "T00:00:00");
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function QuoteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
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
