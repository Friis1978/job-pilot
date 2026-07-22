import * as Sentry from "@sentry/nextjs";
import { redactDeep } from "@/lib/ai/redact";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === "production",
  tracesSampleRate: 0,
  // Users bring their own Anthropic keys, so anything leaving for Sentry gets
  // swept first. Applied at init rather than at each captureException call —
  // the call sites that attach `extra` payloads are exactly the ones that would
  // be forgotten later.
  beforeSend(event) {
    return redactDeep(event);
  },
});
