"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-text-muted hover:text-error transition-colors"
    >
      Sign out
    </button>
  );
}
