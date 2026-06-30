"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import type { Connection } from "@/types";
import { isRecruiter, isManager } from "@/lib/network-utils";
import { SortIcon } from "@/components/ui/SortIcon";

type Props = {
  connections: Connection[];
};

function RoleBadge({ connection }: { connection: Connection }) {
  if (isRecruiter(connection)) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-linkedin-light text-linkedin">
        Recruiter
      </span>
    );
  }
  if (isManager(connection)) {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-light text-accent">
        Manager
      </span>
    );
  }
  return null;
}

function FavoriteButton({ connection }: { connection: Connection }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [optimistic, setOptimistic] = useState(connection.is_favorite);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    const next = !optimistic;
    setOptimistic(next);
    try {
      const res = await fetch(`/api/network/connections/${connection.id}/favorite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_favorite: next }),
      });
      const data = await res.json() as { success: boolean };
      if (!data.success) {
        setOptimistic(!next);
        toast("Failed to update favorite", "error");
      } else {
        router.refresh();
      }
    } catch {
      setOptimistic(!next);
      toast("Failed to update favorite", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className="text-text-muted hover:text-warning transition-colors disabled:opacity-40"
      aria-label={optimistic ? "Remove from favorites" : "Add to favorites"}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill={optimistic ? "currentColor" : "none"} className={optimistic ? "text-warning" : ""}>
        <path d="M8 1.5l1.9 3.8 4.2.6-3 2.9.7 4.2L8 11l-3.8 2 .7-4.2-3-2.9 4.2-.6L8 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function NotesCell({ connection }: { connection: Connection }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(connection.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (value === (connection.notes ?? "")) { setEditing(false); return; }
    setSaving(true);
    try {
      await fetch(`/api/network/connections/${connection.id}/notes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      router.refresh();
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
        disabled={saving}
        className="w-full text-xs border border-accent rounded px-2 py-1 outline-none bg-surface"
        placeholder="Add a note…"
      />
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      className="text-xs text-left w-full truncate text-text-muted hover:text-text-secondary transition-colors"
    >
      {value || <span className="italic">Add note…</span>}
    </button>
  );
}

const PAGE_SIZE = 25;

type SortKey = "name" | "company" | "position";
type SortDir = "asc" | "desc";


export function ConnectionsTable({ connections }: Props) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  const filtered = connections.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(q) ||
      c.last_name.toLowerCase().includes(q) ||
      c.company.toLowerCase().includes(q) ||
      c.position.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) => {
    let av = "", bv = "";
    if (sortKey === "name") { av = `${a.first_name} ${a.last_name}`; bv = `${b.first_name} ${b.last_name}`; }
    else if (sortKey === "company") { av = a.company; bv = b.company; }
    else if (sortKey === "position") { av = a.position; bv = b.position; }
    return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, company, or position…"
          className="flex-1 text-sm border-2 border-border rounded-lg px-3 py-2 bg-surface outline-none focus:border-accent transition-colors"
        />
        <span className="text-sm text-text-muted shrink-0">{filtered.length} connections</span>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">
                <button onClick={() => handleSort("name")} className="flex items-center hover:text-text-primary transition-colors">
                  Name <SortIcon active={sortKey === "name"} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">
                <button onClick={() => handleSort("company")} className="flex items-center hover:text-text-primary transition-colors">
                  Company <SortIcon active={sortKey === "company"} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">
                <button onClick={() => handleSort("position")} className="flex items-center hover:text-text-primary transition-colors">
                  Position <SortIcon active={sortKey === "position"} dir={sortDir} />
                </button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Notes</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                  {search ? "No connections match your search." : "No connections yet."}
                </td>
              </tr>
            )}
            {paginated.map((c) => (
              <tr key={c.id} className="hover:bg-surface-secondary transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-accent-light flex items-center justify-center text-xs font-semibold text-accent shrink-0">
                      {c.first_name[0]}{c.last_name[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-text-primary">
                          {c.first_name} {c.last_name}
                        </span>
                        <RoleBadge connection={c} />
                      </div>
                      {c.linkedin_url && (
                        <a
                          href={c.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-linkedin hover:underline"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-text-secondary">{c.company || "—"}</td>
                <td className="px-4 py-3 text-text-secondary max-w-48 truncate">{c.position || "—"}</td>
                <td className="px-4 py-3 max-w-48">
                  <NotesCell connection={c} />
                </td>
                <td className="px-4 py-3 text-right">
                  <FavoriteButton connection={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-text-muted">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-sm text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
