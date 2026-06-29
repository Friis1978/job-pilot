import type { Connection } from "@/types";
import { ConnectionsTable } from "@/components/network/ConnectionsTable";

type Props = {
  connections: Connection[];
};

export function NotesView({ connections }: Props) {
  const withNotes = connections.filter((c) => c.notes && c.notes.trim() !== "");

  if (withNotes.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm text-center">
        <p className="text-sm text-text-muted">No notes yet.</p>
        <p className="text-xs text-text-muted mt-1">Add notes to any connection from the Connections tab.</p>
      </div>
    );
  }

  return <ConnectionsTable connections={withNotes} />;
}
