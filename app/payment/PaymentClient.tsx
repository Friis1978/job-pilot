"use client";

import { useState } from "react";
import Link from "next/link";

type Payment = {
  id: string;
  amount_usd: number;
  paid_at: string;
  stripe_session_id: string;
};

export function PaymentClient({ creditBalance, payments }: { creditBalance: number; payments: Payment[] }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLow = creditBalance < 2;

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payment/create-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed to create session");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Balance card */}
      <div className={`bg-surface border rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${isLow ? "border-error/40" : "border-border"}`}>
        <div>
          <p className="text-sm text-text-muted mb-1">Current balance</p>
          <p className={`text-4xl font-bold ${isLow ? "text-error" : "text-text-primary"}`}>
            ${creditBalance.toFixed(2)}
          </p>
          {isLow && (
            <p className="text-xs text-error mt-1">Your balance is low. Top up to continue using AI features.</p>
          )}
        </div>
        <div className="flex flex-col gap-2 items-start sm:items-end">
          {error && <p className="text-xs text-error">{error}</p>}
          <button
            onClick={handlePay}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 ${
              isLow
                ? "bg-error text-white hover:bg-error/90"
                : "bg-accent text-white hover:bg-accent/90"
            }`}
          >
            {loading ? "Redirecting to Stripe…" : "Add $20 credit"}
          </button>
          <p className="text-xs text-text-muted">Secure payment via Stripe</p>
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-text-primary">Payment history</h2>
        </div>
        {payments.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <p className="text-sm text-text-muted">No payments yet.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted border-b border-border">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Amount</th>
                <th className="px-6 py-3 font-medium hidden sm:table-cell">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 text-text-primary whitespace-nowrap">
                    {new Date(p.paid_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4 text-text-primary font-medium">${Number(p.amount_usd).toFixed(2)}</td>
                  <td className="px-6 py-4 text-text-muted font-mono text-xs hidden sm:table-cell truncate max-w-xs">
                    {p.stripe_session_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-text-muted text-center">
        Questions? <Link href="mailto:support@devjobinfo.com" className="underline">Contact support</Link>
      </p>
    </div>
  );
}
