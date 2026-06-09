"use client";

import { useRouter } from "next/navigation";
import { insforge } from "@/lib/insforge-client";
import posthog from "posthog-js";
import { Navbar } from "@/components/layout/Navbar";

export default function DashboardPage() {
  const router = useRouter();

  async function handleLogout() {
    posthog.capture("user_signed_out");
    posthog.reset();
    try {
      await insforge.auth.signOut();
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Clear cookies best-effort — navigate away regardless
    }
    router.replace("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex items-center justify-center" style={{ minHeight: "calc(100vh - 64px)" }}>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-text-primary mb-2">Dashboard</h1>
          <p className="text-text-secondary mb-6">Coming soon.</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-surface border border-border text-sm text-text-primary hover:bg-surface-secondary transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
