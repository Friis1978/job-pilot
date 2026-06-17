"use client";

import { useEffect } from "react";

// Proactively refresh the session every 3 minutes so the user is never
// logged out due to idle token expiry. The /api/auth/refresh endpoint
// is skipped by the proxy's updateSession (no double-refresh risk).
const REFRESH_INTERVAL_MS = 3 * 60 * 1000;

export function SessionKeepAlive() {
  useEffect(() => {
    const refresh = () =>
      fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).catch(() => null);

    const id = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
