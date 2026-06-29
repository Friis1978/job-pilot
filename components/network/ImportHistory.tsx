import type { NetworkImport } from "@/types";

type Props = {
  imports: NetworkImport[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ImportHistory({ imports }: Props) {
  if (imports.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-2xl p-8 shadow-sm text-center">
        <p className="text-sm text-text-muted">No imports yet.</p>
        <p className="text-xs text-text-muted mt-1">Import your LinkedIn Connections.csv to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-secondary">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Date</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">File</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wide">Connections</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {imports.map((imp) => (
            <tr key={imp.id} className="hover:bg-surface-secondary transition-colors">
              <td className="px-4 py-3 text-text-secondary">{formatDate(imp.imported_at)}</td>
              <td className="px-4 py-3 text-text-muted">{imp.file_name ?? "—"}</td>
              <td className="px-4 py-3 text-text-primary font-medium">{imp.connection_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
