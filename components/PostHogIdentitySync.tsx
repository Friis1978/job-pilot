"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import { insforge } from "@/lib/insforge-client";

// Runs once on app startup. If a session cookie is present, identifies the
// current user in PostHog so all client-side events are linked to the user.
export function PostHogIdentitySync() {
  useEffect(() => {
    async function syncIdentity() {
      const { data } = await insforge.auth.getCurrentUser();
      if (data?.user) {
        posthog.identify(data.user.id, {
          email: data.user.email,
        });
      }
    }
    syncIdentity();
  }, []);

  return null;
}
