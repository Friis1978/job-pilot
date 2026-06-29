"use client";

import { useState } from "react";
import type { Connection, NetworkImport } from "@/types";
import { isRecruiter } from "@/lib/network-utils";
import { ImportButton } from "@/components/network/ImportButton";
import { ConnectionsTable } from "@/components/network/ConnectionsTable";
import { RecruitersView } from "@/components/network/RecruitersView";
import { CompaniesView } from "@/components/network/CompaniesView";
import { FavoritesView } from "@/components/network/FavoritesView";
import { NotesView } from "@/components/network/NotesView";
import { ImportHistory } from "@/components/network/ImportHistory";

type Tab = "connections" | "recruiters" | "companies" | "favorites" | "notes" | "history";

type Props = {
  connections: Connection[];
  imports: NetworkImport[];
};

export function NetworkTabs({ connections, imports }: Props) {
  const [tab, setTab] = useState<Tab>("connections");

  const recruiterCount = connections.filter(isRecruiter).length;
  const favoriteCount = connections.filter((c) => c.is_favorite).length;
  const notesCount = connections.filter((c) => c.notes && c.notes.trim() !== "").length;
  const companiesCount = new Set(connections.map((c) => c.company.toLowerCase().trim()).filter(Boolean)).size;

  const tabs: Array<{ key: Tab; label: string; count?: number }> = [
    { key: "connections", label: "Connections", count: connections.length },
    { key: "recruiters", label: "Recruiters", count: recruiterCount },
    { key: "companies", label: "Companies", count: companiesCount },
    { key: "favorites", label: "Favorites", count: favoriteCount },
    { key: "notes", label: "Notes", count: notesCount },
    { key: "history", label: "Import History", count: imports.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === t.key
                  ? "bg-accent text-accent-foreground"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    tab === t.key
                      ? "bg-accent-foreground/20 text-accent-foreground"
                      : "bg-surface-tertiary text-text-muted"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <ImportButton />
      </div>

      {tab === "connections" && <ConnectionsTable connections={connections} />}
      {tab === "recruiters" && <RecruitersView connections={connections} />}
      {tab === "companies" && <CompaniesView connections={connections} />}
      {tab === "favorites" && <FavoritesView connections={connections} />}
      {tab === "notes" && <NotesView connections={connections} />}
      {tab === "history" && <ImportHistory imports={imports} />}
    </div>
  );
}
