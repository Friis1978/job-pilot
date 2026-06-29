import type { Connection } from "@/types";
import { ConnectionsTable } from "@/components/network/ConnectionsTable";

type Props = {
  connections: Connection[];
};

export function FavoritesView({ connections }: Props) {
  const favorites = connections.filter((c) => c.is_favorite);

  if (favorites.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm text-center">
        <p className="text-sm text-text-muted">No favorites yet.</p>
        <p className="text-xs text-text-muted mt-1">Star any connection to add them here.</p>
      </div>
    );
  }

  return <ConnectionsTable connections={favorites} />;
}
