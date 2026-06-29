"use client";

import { useState } from "react";
import type { Connection } from "@/types";
import { isRecruiter, isManager, networkStrength } from "@/lib/network-utils";

type Props = {
  connections: Connection[];
};

type CompanyGroup = {
  company: string;
  connections: Connection[];
  recruiterCount: number;
  managerCount: number;
};

function StrengthBar({ strength }: { strength: ReturnType<typeof networkStrength> }) {
  const levels = { none: 0, weak: 1, moderate: 2, strong: 3 };
  const colors = { none: "bg-border", weak: "bg-warning", moderate: "bg-info", strong: "bg-success" };
  const n = levels[strength];
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className={`h-1.5 w-5 rounded-full ${i <= n ? colors[strength] : "bg-border"}`}
        />
      ))}
    </div>
  );
}

export function CompaniesView({ connections }: Props) {
  const [search, setSearch] = useState("");

  const groupMap = new Map<string, CompanyGroup>();
  for (const c of connections) {
    const key = c.company.toLowerCase().trim();
    if (!key) continue;
    const existing = groupMap.get(key) ?? { company: c.company, connections: [], recruiterCount: 0, managerCount: 0 };
    existing.connections.push(c);
    if (isRecruiter(c)) existing.recruiterCount++;
    else if (isManager(c)) existing.managerCount++;
    groupMap.set(key, existing);
  }

  const groups = Array.from(groupMap.values())
    .sort((a, b) => b.connections.length - a.connections.length);

  const filtered = search
    ? groups.filter((g) => g.company.toLowerCase().includes(search.toLowerCase()))
    : groups;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies…"
          className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-surface outline-none focus:border-accent transition-colors"
        />
        <span className="text-sm text-text-muted shrink-0">{filtered.length} companies</span>
      </div>

      <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-secondary">
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Company</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Connections</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Recruiters</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Managers</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Strength</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-light">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-text-muted">
                  {search ? "No companies match your search." : "No connections imported yet."}
                </td>
              </tr>
            )}
            {filtered.map((g) => {
              const strength = networkStrength(g.connections);
              return (
                <tr key={g.company} className="hover:bg-surface-secondary transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary">{g.company}</td>
                  <td className="px-4 py-3 text-text-secondary">{g.connections.length}</td>
                  <td className="px-4 py-3 text-text-secondary">{g.recruiterCount || "—"}</td>
                  <td className="px-4 py-3 text-text-secondary">{g.managerCount || "—"}</td>
                  <td className="px-4 py-3">
                    <StrengthBar strength={strength} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
