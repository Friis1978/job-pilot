"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

type Props = {
  userId: string;
  email: string | null;
};

// Receives user identity from the server — no client-side auth calls needed.
export function PostHogIdentitySync({ userId, email }: Props) {
  useEffect(() => {
    posthog.identify(userId, email ? { email } : undefined);
  }, [userId, email]);

  return null;
}
