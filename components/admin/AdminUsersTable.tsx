"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  /** Aggregated from token_usage via the user_ai_spend view. */
  ai_spend_usd: number;
  ai_generations: number;
  credit_balance_usd: number;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/10 text-warning border border-warning/20",
  approved: "bg-success-lightest text-success-foreground border border-success-light",
  rejected: "bg-surface-secondary text-text-muted border border-border",
};

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AdminUsersTable({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const [loadingApprove, setLoadingApprove] = useState<string | null>(null);
  const [loadingReject, setLoadingReject] = useState<string | null>(null);
  const [loadingResend, setLoadingResend] = useState<string | null>(null);

  async function handleApprove(userId: string) {
    setLoadingApprove(userId);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error();
      toast("User approved — approval email sent", "success");
      router.refresh();
    } catch {
      toast("Failed to approve user", "error");
    } finally {
      setLoadingApprove(null);
    }
  }

  async function handleResendEmail(userId: string) {
    setLoadingResend(userId);
    try {
      const res = await fetch("/api/admin/resend-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error();
      toast("Email sent", "success");
    } catch {
      toast("Failed to send email", "error");
    } finally {
      setLoadingResend(null);
    }
  }

  async function handleReject(userId: string) {
    setLoadingReject(userId);
    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error();
      toast("User rejected", "success");
      router.refresh();
    } catch {
      toast("Failed to reject user", "error");
    } finally {
      setLoadingReject(null);
    }
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-16 text-text-muted text-sm">
        No users yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-secondary">
            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide text-text-secondary">Name</th>
            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide text-text-secondary">Email</th>
            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide text-text-secondary">Signed up</th>
            <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide text-text-secondary">AI spend</th>
            <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wide text-text-secondary">Credit left</th>
            <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wide text-text-secondary">Status</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-surface-secondary transition-colors">
              <td className="px-5 py-3.5 font-medium text-text-primary">
                {u.full_name ?? <span className="text-text-muted">—</span>}
              </td>
              <td className="px-5 py-3.5 text-text-secondary">{u.email ?? "—"}</td>
              <td className="px-5 py-3.5 text-text-secondary">{formatDate(u.created_at)}</td>
              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                <span className="text-text-primary font-medium">{formatMoney(u.ai_spend_usd)}</span>
                {u.ai_generations > 0 && (
                  <span className="block text-xs text-text-muted">
                    {u.ai_generations} generation{u.ai_generations === 1 ? "" : "s"}
                  </span>
                )}
              </td>
              <td className="px-5 py-3.5 text-right whitespace-nowrap">
                <span className={u.credit_balance_usd <= 0 ? "text-error font-medium" : "text-text-primary"}>
                  {formatMoney(u.credit_balance_usd)}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[u.approval_status] ?? STATUS_STYLES.rejected}`}>
                  {u.approval_status}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2 justify-end">
                  {u.approval_status === "pending" && (
                    <>
                      <button
                        onClick={() => handleApprove(u.id)}
                        disabled={loadingApprove === u.id || loadingReject === u.id || loadingResend === u.id}
                        className="px-3 py-1.5 text-xs font-medium text-success-foreground bg-success-lightest border border-success-light rounded-md hover:bg-success-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingApprove === u.id ? "Approving…" : "Approve"}
                      </button>
                      <button
                        onClick={() => handleReject(u.id)}
                        disabled={loadingApprove === u.id || loadingReject === u.id || loadingResend === u.id}
                        className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-secondary border border-border rounded-md hover:bg-surface-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loadingReject === u.id ? "Rejecting…" : "Reject"}
                      </button>
                    </>
                  )}
                  {u.approval_status !== "rejected" && (
                    <button
                      onClick={() => handleResendEmail(u.id)}
                      disabled={loadingApprove === u.id || loadingReject === u.id || loadingResend === u.id}
                      className="px-3 py-1.5 text-xs font-medium text-text-secondary bg-surface-secondary border border-border rounded-md hover:bg-surface-tertiary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loadingResend === u.id ? "Sending…" : "Resend email"}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
